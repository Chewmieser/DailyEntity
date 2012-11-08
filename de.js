// DailyEntity Backend v1.0
// Actual version: 3.0
// Codename: Chocolate Chip Cheesecake
// 7/2012

// Profiling support
/*require('nodetime').profile({
	accountKey: '0b3cbcf57ce74ecfaf177a6e6253b583e104bc4d', 
	appName: 'DailyEntity'
});*/

var versionNumber="1.0";
var codeName="Chocolate Chip Cheesecake";

// Load libs
var express=require("express"); // Routing
var pg=require('pg'); // New DB
var mustache=require('mustache'); // Template
var fs=require("fs");
var path=require("path");
var nowjs=require("now");
var md5=require("MD5");

// Create server
var app=express.createServer();
//var client=new pg.Client(process.env.DATABASE_URL || "postgres://Steven@localhost/dailyentity");
//client.connect();

// app.configure options
app.use(express.logger('tiny'));
app.use(express.cookieParser());
app.use(express.staticCache());
app.use("/includes", express.static(__dirname + '/includes',{maxAge: 86400000}));
app.use(express.compress());

// PG Configuration Options
pg.defaults.poolSize=20;

// Development session store !!!----!!!
//var MemoryStore=express.session.MemoryStore;
//var sessionStore=new MemoryStore({reapInterval: 60000 * 10});
//app.use(express.session({secret: "de123dezxc", store: sessionStore}));

// Production session store !!!----!!!
var hredis=require('connect-heroku-redis')(express);
var sessionStore=new hredis({maxAge: 86400000*7});
app.use(express.session({secret: "de123dezxc", store: sessionStore, cookie: {maxAge: 86400000*7}}));

// Begin listening
app.listen(process.env.PORT || 3000);

// Shake it like a salt shaker
var passHash={
	before: "de{crazy}",
	after: "12deFunlol1z"
}

// Start now.js
var everyone=nowjs.initialize(app,{socketio: {"transports": ["xhr-polling"], "polling duration": 10}});

// Configuration
const DEBUG_INFO=0, DEBUG_WARN=1, DEBUG_ERROR=2;
global.client=[];

// Keep templates in memory
var templates={};

// Run a query from the pool
function doQuery(qu,arg,call){
	var tmp={
		qu: qu,
		arg: arg,
		call: call
	}
	
	pg.connect(process.env.DATABASE_URL || "postgres://Steven@localhost/dailyentity", function(err,c){
		if (err!=null){console.log('Error connecting to postgres');console.log(err);}
		c.query(qu,arg,call);
	}.bind(tmp));
}

// Handle debug messages
function debug(type,message){
	if (type==DEBUG_INFO){
		console.log("INFO: "+message);
	}
}

// Add a client object to the clients list
function createClient(req,res){
	return global.client.push({
		resource_id: res,
		request: req,
		page_data: {
			path: req.path,
			params: req.params,
			posts: [],
			total_posts: 0,
			tag_data: {
				id: 0,
				name: "",
				description: ""
			}
		}
	}) - 1;
}

// When we finish processing the client, remove them from the system
function killClient(clientId){
	global.client.splice(clientId,1);
}

// Process a tag page request
function loadTagPage(clientId){
	// Grab tag to load
	var tag=global.client[clientId].page_data.params[0];
	global.client[clientId].page_data.tag_data.name=tag;
	this.clientId=clientId;
	debug(DEBUG_INFO,"Client '"+clientId+"' requesting tag page '"+tag+"'");
	
	// Find the tag ID
	doQuery("SELECT tag_id,tag_description FROM tags WHERE tag_name=$1",[tag],function(err,result){
		// If there is no tag ID, create the tag
		var rows=result.rows;
		if (Object.keys(rows).length==0){
			// Send the tag page
			doQuery("INSERT INTO tags (tag_name, tag_description) VALUES($1,'')",[tag],function(err,result){
				debug(DEBUG_INFO,"Tag '"+tag+"' created");
				
				sendTagPage(this.clientId);
			}.bind(this)); // Pass context of 'this' into function
		}else{
			// Grab the tag
			var tagId=rows[0].id;
			
			global.client[this.clientId].page_data.tag_data.id=rows[0].tag_id;
			global.client[this.clientId].page_data.tag_data.description=rows[0].tag_description;

			// Find relevant post IDs
			doQuery("SELECT post_id FROM post_tags WHERE tag_id="+rows[0].tag_id+" ORDER BY post_id DESC LIMIT 20",function(err,result){
				var rows=result.rows;
				// If we have posts available, grab them
				if (Object.keys(rows).length>0){
					for (var r in Object.keys(rows)){
						global.client[this.clientId].page_data.total_posts++;
						doQuery("SELECT posts.post, posts.user_id, posts.post_id, users.name, users.avatar_url, attachments.attachment_url FROM posts LEFT JOIN attachments ON posts.post_id=attachments.post_id LEFT JOIN users ON posts.user_id=users.user_id WHERE posts.post_id="+rows[r].post_id,function(err,result){
							var rows=result.rows;
							var pid=global.client[this.clientId].page_data.posts.push({
								post: rows[0].post,
								user_id: rows[0].user_id,
								post_id: rows[0].post_id,
								user_name: rows[0].name,
								avatar_url: rows[0].avatar_url,
								attachments: []
							})-1;
							
							// Peer into data for attachments
							var attachments=[];
							for (i in rows){
								if (rows[i].attachment_url!=null){
									attachments.push(rows[i].attachment_url);
								}
							}
							global.client[this.clientId].page_data.posts[pid].attachments=attachments;
							
							var tmp={
								clientId: this.clientId,
								pid: pid
							}
							
							doQuery("SELECT comments.comment_id, comments.comment, comments.user_id, comments.post_id, comments.timestamp, attachments.attachment_url, users.name, users.avatar_url FROM comments LEFT JOIN attachments ON comments.comment_id=attachments.comment_id LEFT JOIN users ON comments.user_id=users.user_id WHERE comments.post_id="+rows[0].post_id+" ORDER BY comments.comment_id DESC",function(err,result){
								var rows=result.rows;
								var tmp=[];
								
								for (i in rows){
									// Go through each element
									var found=false;
									for (ii in tmp){
										// Is this our proper element?
										if (tmp[ii].id==rows[i].comment_id){
											// Add our attachment, if available
											found=true;
											if (rows[i].attachment_url!=null){
												tmp[ii].attachments.push(rows[i].attachment_url);
											}
										}
									}
									
									// We never found it... Create the object
									if (!found){
										var tmpCurr={
											id: rows[i].comment_id,
											comment: rows[i].comment,
											user_id: rows[i].user_id,
											post_id: rows[i].post_id,
											timestamp: rows[i].timestamp,
											attachments: []
										}
										
										if (rows[i].attachment_url!=null){
											tmpCurr.attachments.push(rows[i].attachment_url);
										}

										var curr=tmp.push(tmpCurr)-1;
										tmp[curr].user_name=rows[i].name;
										tmp[curr].user_id=rows[i].user_id;
										tmp[curr].avatar_url=rows[i].avatar_url;
									}
									
								}
								global.client[this.clientId].page_data.posts[this.pid].comments=tmp;
								
								global.client[this.clientId].page_data.total_posts--;
								if (global.client[this.clientId].page_data.total_posts==0){
									// Sort our object
									global.client[this.clientId].page_data.posts.sort(function(a,b){return b.post_id-a.post_id});
									sendTagPage(this.clientId);
								}
							}.bind(tmp));
						}.bind(this)); // Pass context of 'this' into function
					}
				}else{
					// No relevant posts, send the tag page
					sendTagPage(this.clientId);
				}
			}.bind(this)); // Pass context of 'this' into function
		}
	}.bind(this)); // Pass context of 'this' into function
}

// Send the tag page to the user
function sendTagPage(clientId){
	// Load all templates... Only if they need to be loaded. Let's not tax the filesystem otherwise.
	if (templates.main==undefined){
		console.log("Loading tag page templates");
		templates={
			main: fs.readFileSync('./views/tag_page/index.html','utf8'),
			header: fs.readFileSync("./views/tag_page/partials/header.mustache","utf8"),
			postBox: fs.readFileSync("./views/tag_page/partials/postbox.mustache","utf8"),
			sideBar: fs.readFileSync("./views/tag_page/partials/sidebar.mustache","utf8"),
			navBar: fs.readFileSync('./views/tag_page/partials/navbar.mustache','utf8'),
			post: fs.readFileSync('./views/tag_page/partials/post.mustache','utf8'),
			comment: fs.readFileSync('./views/tag_page/partials/comment.mustache','utf8')
		}
	}
	
	var view={
		tag_name: global.client[this.clientId].page_data.tag_data.name,
		tag_slogan: global.client[this.clientId].page_data.tag_data.description
	}
	
	var partials={
		header: templates.header,
		content: "",
		user_data: "{}"
	}
	partials.content+=templates.postBox;
	
	// Load sidebar
	var ps={
		popular_tags: '',
		online_users: ''
	}
	partials.sidebar=mustache.to_html(templates.sideBar,{},ps);
	
	// Load the nav bar template
	var v={
		notification_count: 0,
		user_name: "sign in"
	}
	
	var p={
		navbar_links: "",
		notifications: "",
		account_menu: "<form style='padding-left:5px;padding-right:5px;'><div class='control-group' id='logincontrols'><li><input id='loginUsername' type='text' placeholder='username'></li><li><input id='loginPass' type='password' placeholder='password'></li></div><li><button type='button' id='signupButton' onClick='modifyLogin()' class='btn'>sign up</button><button type='button' id='loginSubmit' onClick='loginUser()' class='btn btn-primary pull-right'>login</button></form></li>"
	}
	
	if (global.client[clientId].request.session.userId!=undefined){
		partials.user_data="{user_name: '"+global.client[clientId].request.session.username+"', user_id: '"+global.client[clientId].request.session.userId+"'}";
		p.account_menu="<li><a href='#' onClick='showProfilePage()'>Profile</a></li><li class='divider'></li><li><a href='#' onClick='logout();'>Sign out</a></li>";
		v.user_name=global.client[clientId].request.session.username;
	}
	
	partials.nav=mustache.to_html(templates.navBar,v,p);
	
	// Load the post template
	var buff="";
	
	// If there are no posts available, report this to the user
	if (global.client[clientId].page_data.posts.length==0){
		buff="There doesn't seem to be anything here... Why not be the first to post something?";
	}else{
		for (i in global.client[clientId].page_data.posts){
			var v={
				post_id: global.client[clientId].page_data.posts[i].post_id,
				avatar_url: global.client[clientId].page_data.posts[i].avatar_url,
				user_name: global.client[clientId].page_data.posts[i].user_name,
				user_id: global.client[clientId].page_data.posts[i].user_id,
				total_comments: global.client[clientId].page_data.posts[i].comments.length
			}
			
			var p={
				post_content: global.client[clientId].page_data.posts[i].post,
				comments: ""
			}
			
			if (global.client[clientId].page_data.posts[i].attachments.length>0){
				// We've got attachments. Modify the post content.
				var tmp="";
				for (ii in global.client[clientId].page_data.posts[i].attachments){
					tmp+='<li class="span2"><a href="'+global.client[clientId].page_data.posts[i].attachments[ii]+'" class="thumbnail" rel="lightbox"><img src="'+global.client[clientId].page_data.posts[i].attachments[ii]+'" style="max-height:100px;" /></a></li>';
				}

				ii++

				p.post_content+='<br><br><small>Attachments <sup><span class="badge" onClick="toggleThumb(this);">'+ii+'</span></sup></small><p><ul class="thumbnails" style="'+((p.post_content.indexOf("nsfw")==-1)?('display: block;'):('display: none;'))+'">';
				p.post_content+=tmp;
				p.post_content+="</ul></p>";
			}
			
			for (ii in global.client[clientId].page_data.posts[i].comments){
				var vv={
					user_name: global.client[clientId].page_data.posts[i].comments[ii].user_name,
					avatar_url: global.client[clientId].page_data.posts[i].comments[ii].avatar_url,
					user_id: global.client[clientId].page_data.posts[i].comments[ii].user_id,
					comment_id: global.client[clientId].page_data.posts[i].comments[ii].id
				}
				
				var pp={
					comment: global.client[clientId].page_data.posts[i].comments[ii].comment
				}
				
				if (global.client[clientId].page_data.posts[i].comments[ii].attachments.length>0){
					// We've got attachments. Modify the post content.
					var tmp="";
					for (iii in global.client[clientId].page_data.posts[i].comments[ii].attachments){
						tmp+='<li class="span2"><a href="'+global.client[clientId].page_data.posts[i].comments[ii].attachments[iii]+'" class="thumbnail" rel="lightbox"><img src="'+global.client[clientId].page_data.posts[i].comments[ii].attachments[iii]+'" style="max-height:100px;" /></a></li>';
					}

					iii++;

					pp.comment+='<br><br><small>Attachments <sup><span class="badge" onClick="toggleThumb(this);">'+iii+'</span></sup></small><p><ul class="thumbnails" style="'+((pp.comment.indexOf("nsfw")==-1)?('display: block;'):('display: none;'))+'">';
					pp.comment+=tmp;
					pp.comment+="</ul></p>";
				}
				
				p.comments+=mustache.to_html(templates.comment,vv,pp);
			}
			
			buff+=mustache.to_html(templates.post,v,p);
		}
	}
	partials.content+=buff;
	
	// Send the page to the user
	global.client[clientId].resource_id.contentType('text/html');
	global.client[clientId].resource_id.end(mustache.to_html(templates.main,view,partials));
	
	killClient(clientId);
}

function postContent(user_id,content,tags,attachments,callback){
	this.tags=tags;
	this.attachments=attachments;
	doQuery("INSERT INTO posts (post, user_id, timestamp) VALUES($1,$2,now()) RETURNING post_id",[content,user_id],function(err,result){
		this.postId=result.rows[0].post_id;
		this.tagTotal=tags.length;
		
		resolveTags(this.tags,function(t){
			for (i in t){
				doQuery("INSERT INTO post_tags (post_id, tag_id) VALUES($1,$2)",[this.postId,t[i]],function(err,result){
					this.tagTotal--;

					if (this.tagTotal==0){
						// Save post attachments now
						if (this.attachments.length>0){
							var attach=this.attachments.length;
							
							for (ii in this.attachments){
								doQuery("INSERT INTO attachments (post_id, attachment_url) VALUES($1, $2)",[this.postId, this.attachments[ii]],function(err,result){
									attach--;
									if (attach==0){
										
									}
								});
							}
						}
						
						if (attach==undefined){
							
						}
						
						callback(this.postId);
					}
				}.bind(this));
			}	
		}.bind(this));
	}.bind(this));
}

function postComment(user_id,post_id,content,tags,attachments,callback){
	// Insert post
	this.post_id=post_id;
	this.tags=tags;
	this.attachments=attachments;
	doQuery("INSERT INTO comments (comment,user_id,post_id,timestamp) VALUES($1,$2,$3,now()) RETURNING comment_id",[content,user_id,post_id],function(err,result){
		// Find out what tags the post contains
		this.comment_id=result.rows[0].comment_id;
		resolveTags(this.tags,function(t){
			this.tagTotal=t.length;
			for (i in t){
				doQuery("SELECT modifyPostTags($1, $2)",[this.post_id,t[i]],function(err,result){
					// Tag already exists for post
					this.tagTotal--;
					if (this.tagTotal==0){
						if (this.attachments.length>0){
							var attach=this.attachments.length;
							
							for (ii in this.attachments){
								doQuery("INSERT INTO attachments (comment_id, attachment_url) VALUES($1, $2)",[this.comment_id, this.attachments[ii]],function(err,result){
									attach--;
									if (attach==0){
										
									}
								});
							}
						}
						
						if (attach==undefined){
							
						}
						
						callback(this.post_id);
					}
				}.bind(this));
			}
		}.bind(this));
	}.bind(this));
}

function resolveTags(tags,callback){
	this.tags=tags;
	this.resolved=[];
	this.totalTags=tags.length;
	
	for (i in tags){
		console.log(tags[i]);
		doQuery("SELECT findTag($1)",[tags[i]],function(err,result){
			if (err){ console.log(err); }
			this.resolved.push(result.rows[0].findtag);
			this.totalTags--;

			if (this.totalTags==0){
				
				callback(this.resolved);
			}
		}.bind(this));
	}
}

function resolveTagsById(tags,callback){
	this.tags=tags;
	this.resolved=[];
	this.totalTags=tags.length;
	
	for (i in tags){
		doQuery("SELECT tag_name FROM tags WHERE tag_id=$1",[tags[i]],function(err,result){
			if (err){ console.log(err); }
			this.resolved.push(result.rows[0].tag_name);
			this.totalTags--;

			if (this.totalTags==0){
				
				callback(this.resolved);
			}
		}.bind(this));
	}
}

function generatePopularTags(callback){
	var tags=[];
	doQuery("SELECT tags.tag_name,count(post_tags.post_tags_id) FROM tags INNER JOIN post_tags ON tags.tag_id=post_tags.tag_id GROUP BY tags.tag_name ORDER BY count DESC;",function(err,result){
		for (i in result.rows){
			tags.push(result.rows[i].tag_name);
		}
		
		callback(tags);
	});
}

// Opening a tag page
app.get('/tag/*',function(req,res){
	var clientId=createClient(req,res);
	loadTagPage(clientId);
});

app.get('/',function(req,res){
	var clientId=createClient(req,res);
	global.client[clientId].page_data.params[0]="news";
	loadTagPage(clientId);
});

everyone.now.modifyProfile=function(avatar_url){
	if (this.user.session.userId==undefined){
		return;
	}
	
	this.user.session.avatar_url=avatar_url;
	this.user.session.save();
	

	doQuery("UPDATE users SET avatar_url=$1 WHERE user_id=$2",[avatar_url,this.user.session.userId],function(){
		
	});
}

everyone.now.loadNavBar=function(){
	

	
	this.tags=[];
	doQuery("SELECT * FROM navlinks WHERE user_id=$1",[this.user.session.userId],function(err,result){
		if (Object.keys(result.rows).length>0){
			for (i in result.rows){
				this.tags.push(result.rows[i].tag_id);
			}
			
			
			
			resolveTagsById(this.tags,function(ta){
				this.now.loadNavBarTags(ta);
			}.bind(this));
		}
	}.bind(this));
}

everyone.now.removeNavLink=function(tagName){
	if (this.user.session.userId==undefined){
		return;
	}
	
	resolveTags([tagName],function(tagIds){
		doQuery("DELETE FROM navlinks WHERE tag_id=$1 AND user_id=$2",[tagIds[0],this.user.session.userId],function(err,result){
			
		});
	}.bind(this));
}

everyone.now.saveNavLink=function(tagName){
	if (this.user.session.userId==undefined){
		this.now.tagSaveError(1);
		return;
	}
	
	resolveTags([tagName],function(tagIds){
		doQuery("INSERT INTO navlinks (tag_id, user_id) VALUES($1,$2)",[tagIds[0],this.user.session.userId],function(err,result){
			
		});
	}.bind(this));
}

everyone.now.getPopularTags=function(){
	generatePopularTags(function(tags){
		this.now.doPopularTags(tags);
	}.bind(this));
}

everyone.now.login=function(username,password){
	username=username.toLowerCase();
	doQuery("SELECT * FROM users WHERE name=$1 AND password=$2",[username,md5(passHash.before+password+passHash.after)],function(err,result){
		var rows=result.rows;
		
		if (Object.keys(rows).length==0){
			this.now.loginResponse(false,{});
		}else{
			
			delete rows[0].password;
			
			rows[0].id=rows[0].user_id;
			this.user.session.userId=rows[0].id;
			this.user.session.username=rows[0].name;
			this.user.session.avatar_url=rows[0].avatar_url;
			this.now.loginResponse(true,rows[0]);
			this.user.session.save();
		}
	}.bind(this));
}

everyone.now.requestActiveUsers=function(){
	

	
	doQuery("SELECT name FROM users WHERE age(now(),last_active) < INTERVAL '10 minutes'",function(err,result){
		
		
		
		if (Object.keys(result.rows).length>0){
			var tmp=[];
			for (i in result.rows){
				tmp.push(result.rows[i].name);
			}

			this.now.returnActiveUsers(tmp);
		}else{
			this.now.returnActiveUsers([]);
		}
	}.bind(this));
}

everyone.now.ping=function(){
	if (this.user.session.userId==undefined){
		return;
	}
	
	doQuery("UPDATE users SET last_active=now() WHERE user_id=$1",[this.user.session.userId],function(err,result){
		
	});
	
	this.now.pong();
}

everyone.now.signup=function(username,password,email){
	this.username=username.toLowerCase();
	this.email=email.toLowerCase();
	this.password=password;
	
	doQuery("SELECT user_id FROM users WHERE name=$1",[username],function(err,result){
		var rows=result.rows;
		if (Object.keys(rows).length==0){
			// They don't exist :D
			doQuery("INSERT INTO users (name, avatar_url, password, email) VALUES($1,'http://i.imgur.com/2KeOZ.png',$2,$3) RETURNING user_id",[this.username,md5(passHash.before+this.password+passHash.after),this.email],function(err,result){
				this.user.session.userId=result.rows[0].user_id;
				this.user.session.username=this.username;
				this.user.session.avatar_url='http://i.imgur.com/2KeOZ.png';

				var userObject={
					id: result.rows[0].user_id,
					name: this.username,
					avatar_url: 'http://i.imgur.com/2KeOZ.png',
					email: this.email
				}

				
				this.now.loginResponse(true,userObject);
				this.user.session.save();
			}.bind(this));
		}else{
			// Username already exists :(
			
			this.now.signupError(1);
		}
	}.bind(this));
}

everyone.now.logout=function(){
	this.user.session.destroy(function(err){});
}

everyone.now.postMessage=function(content,tags,attachments){
	if (this.user.session.userId==undefined){
		this.now.postResponse(0);
		return;
	}
	
	// Parse everything....
	var dat=parseMessage(content);
	content=dat.content;
	tags=tags.concat(dat.tags);
	attachments=dat.attachments;
	
	var post={
		view: {
			post_id: 0,
			avatar_url: this.user.session.avatar_url,
			user_name: this.user.session.username
		},
		
		partials: {
			post_content: content,
			comments: ""
		},
		
		userId: this.user.session.userId,
		tags: tags,
		template: templates.post
	}
	
	if (attachments.length>0){
		// We've got attachments. Modify the post content.
		var tmp="";
		for (i in attachments){
			tmp+='<li class="span2"><a href="'+attachments[i]+'" class="thumbnail" rel="lightbox"><img src="'+attachments[i]+'" style="max-height:100px;" /></a></li>';
		}
		
		i++
		
		post.partials.post_content+='<br><br><small>Attachments <sup><span class="badge" onClick="toggleThumb(this);">'+i+'</span></sup></small><p><ul class="thumbnails" style="'+((post.partials.post_content.indexOf("nsfw")==-1)?('display: block;'):('display: none;'))+'">';
		post.partials.post_content+=tmp;
		post.partials.post_content+="</ul></p>";
	}
	
	this.now.postResponse(1);
	postContent(post.userId,content,tags,attachments,function(postId){
		this.postId=postId;
		this.view.post_id=postId;
		everyone.now.newPost(mustache.to_html(this.template,this.view,this.partials),this.tags);
	}.bind(post));
}

everyone.now.postComment=function(post_id,content,tags,attachments){
	if (this.user.session.userId==undefined){
		this.now.commentResponse(0);
		return;
	}
	
	var dat=parseMessage(content);
	content=dat.content;
	tags=tags.concat(dat.tags);
	attachments=dat.attachments;
	
	var comment={
		view: {
			avatar_url: this.user.session.avatar_url,
			user_name: this.user.session.username
		},
		
		partials: {
			comment: content
		},
		
		userId: this.user.session.userId,
		tags: tags,
		template: templates.comment
	}
	
	if (attachments.length>0){
		// We've got attachments. Modify the post content.
		var tmp="";
		for (i in attachments){
			tmp+='<li class="span2"><a href="'+attachments[i]+'" class="thumbnail" rel="lightbox"><img src="'+attachments[i]+'" style="max-height:100px;" /></a></li>';
		}
		
		i++;
		
		comment.partials.comment+='<br><br><small>Attachments <sup><span class="badge"onClick=" toggleThumb(this);">'+i+'</span></sup></small><p><ul class="thumbnails" style="'+((comment.partials.comment.indexOf("nsfw")==-1)?('display: block;'):('display: none;'))+'">';
		comment.partials.comment+=tmp;
		comment.partials.comment+="</ul></p>";
	}
	
	this.now.commentResponse(1,post_id);
	postComment(comment.userId,post_id,content,tags,attachments,function(postId){
		this.postId=postId;
		everyone.now.newComment(this.postId,mustache.to_html(this.template,this.view,this.partials));
	}.bind(comment));
}

everyone.now.autocompleteTag=function(tag){
	console.log(tag);
	this.now.autocompleteTagResponse("bacon baconizer baconisgud");
}

app.get('/version',function(req,res){
	res.end("DailyEntity Version "+versionNumber+" - "+codeName);
});

app.get('*',function(req,res){
	// User is probably requesting a static file... This should be trucked over to a static file provider or something...
	try{
		if (fs.lstatSync("."+req.path).isFile()){
			res.contentType(path.extname(req.path));
			res.end(fs.readFileSync("."+req.path));
		}
	}catch (e){
		res.send(404);
	}
});

function parseMessage(content){
	var tags=[];
	var attach=[];
	
	content=content.replace(/[#]+[A-Za-z0-9-_]+/g, function(t) {
		tags.push(t.replace("#",""));
		return "<a href='/tag/"+t.replace("#","")+"' class='label'><i class='icon-tag icon-white'></i> "+t.replace("#","")+"</a>";
	});
	
	content=content.replace(/[@]+[A-Za-z0-9-_]+/g, function(t) {
		return "<a href='/user/"+t.replace("@","")+"' class='label label-info'><i class='icon-user icon-white'></i> "+t.replace("@","")+"</a>";
	});
	
	content=content.replace(/(https?:\/\/.*\.(?:png|jpg|gif))/i, function(t){
		var tt=t.split('">');
		if (tt[0]==tt[1]){t=tt[0];}
		attach.push(t);
		return "<a href='#' class='label label-success'><i class='icon-picture icon-white'></i> Attachment</a>";
	});
	
	// Fix auto-linking images (when using the image button)
	content=content.replace('<img src="<a href=','<a href=');
	content=content.replace('</i> Attachment</a>">','</i> Attachment</a>');
	
	// Fix auto-linking images (when link inserted into editor)
	content=content.replace('<a href="<a href=','<a href=');
	content=content.replace('></i> Attachment</a></a>','></i> Attachment</a>');
	
	return {
		content: content,
		tags: tags,
		attachments: attach
	};
}