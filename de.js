// DailyEntity Backend v1.0
// Actual version: 3.0
// Codename: Chocolate Chip Cheesecake
// 7/2012

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

// Create server, connect to MySQL
var app=express.createServer();
var client=new pg.Client(process.env.DATABASE_URL || "postgres://Steven@localhost/dailyentity");
client.connect();

// app.configure options
app.use(express.logger('dev'));
app.use(express.cookieParser());

// Development session store !!!----!!!
//var MemoryStore=express.session.MemoryStore;
//var sessionStore=new MemoryStore({reapInterval: 60000 * 10});
//app.use(express.session({secret: "de123dezxc", store: sessionStore}));

// Production session store !!!----!!!
var hredis=require('connect-heroku-redis')(express);
var sessionStore=new hredis;
app.use(express.session({secret: "de123dezxc", store: sessionStore}));

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
	client.query("SELECT tag_id,tag_description FROM tags WHERE tag_name=$1",[tag],function(err,result){
		// If there is no tag ID, create the tag
		var rows=result.rows;
		if (Object.keys(rows).length==0){
			// Send the tag page
			client.query("INSERT INTO tags (tag_name, tag_description) VALUES($1,'')",[tag],function(err,result){
				debug(DEBUG_INFO,"Tag '"+tag+"' created");
				sendTagPage(this.clientId);
			}.bind(this)); // Pass context of 'this' into function
		}else{
			// Grab the tag
			var tagId=rows[0].id;
			
			global.client[this.clientId].page_data.tag_data.id=rows[0].tag_id;
			global.client[this.clientId].page_data.tag_data.description=rows[0].tag_description;

			// Find relevant post IDs
			client.query("SELECT post_id FROM post_tags WHERE tag_id="+rows[0].tag_id+" ORDER BY post_id DESC",function(err,result){
				var rows=result.rows;
				// If we have posts available, grab them
				if (Object.keys(rows).length>0){
					for (var r in Object.keys(rows)){
						global.client[this.clientId].page_data.total_posts++;
						client.query("SELECT posts.post, posts.user_id, posts.post_id, users.name, users.avatar_url, attachments.attachment_url FROM posts LEFT JOIN attachments ON posts.post_id=attachments.post_id LEFT JOIN users ON posts.user_id=users.user_id WHERE posts.post_id="+rows[r].post_id,function(err,result){
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
							
							client.query("SELECT comments.comment_id, comments.comment, comments.user_id, comments.post_id, comments.timestamp, attachments.attachment_url, users.name, users.avatar_url FROM comments LEFT JOIN attachments ON comments.comment_id=attachments.comment_id LEFT JOIN users ON comments.user_id=users.user_id WHERE comments.post_id="+rows[0].post_id+" ORDER BY comments.comment_id DESC",function(err,result){
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
	// Load all templates
	var templates={
		main: fs.readFileSync('./views/tag_page/index.html','utf8'),
		header: fs.readFileSync("./views/tag_page/partials/header.mustache","utf8"),
		postBox: fs.readFileSync("./views/tag_page/partials/postbox.mustache","utf8"),
		sideBar: fs.readFileSync("./views/tag_page/partials/sidebar.mustache","utf8"),
		navBar: fs.readFileSync('./views/tag_page/partials/navbar.mustache','utf8'),
		post: fs.readFileSync('./views/tag_page/partials/post.mustache','utf8'),
		comment: fs.readFileSync('./views/tag_page/partials/comment.mustache','utf8')
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
		// Iterate through the posts
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

				p.post_content+='<br><br><small>Attachments <sup><span class="badge" onClick="toggleThumb(this);">'+ii+'</span></sup></small><p><ul class="thumbnails" style="display: none;">';
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
						tmp+='<li class="span2"><a href="'+global.client[clientId].page_data.posts[i].attachments[ii]+'" class="thumbnail" rel="lightbox"><img src="'+global.client[clientId].page_data.posts[i].comments[ii].attachments[iii]+'" style="max-height:100px;" /></a></li>';
					}

					iii++;

					pp.comment+='<br><br><small>Attachments <sup><span class="badge" onClick="toggleThumb(this);">'+iii+'</span></sup></small><p><ul class="thumbnails" style="display: none;">';
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
	client.query("INSERT INTO posts (post, user_id, timestamp) VALUES($1,$2,now()) RETURNING post_id",[content,user_id],function(err,result){
		this.postId=result.rows[0].post_id;
		this.tagTotal=tags.length;
		
		resolveTags(this.tags,function(t){
			for (i in t){
				client.query("INSERT INTO post_tags (post_id, tag_id) VALUES($1,$2)",[this.postId,t[i]],function(err,result){
					this.tagTotal--;

					if (this.tagTotal==0){
						// Save post attachments now
						if (this.attachments.length>0){
							for (ii in this.attachments){
								client.query("INSERT INTO attachments (post_id, attachment_url) VALUES($1, $2)",[this.postId, this.attachments[ii]],function(err,result){});
							}
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
	client.query("INSERT INTO comments (comment,user_id,post_id,timestamp) VALUES($1,$2,$3,now()) RETURNING comment_id",[content,user_id,post_id],function(err,result){
		// Find out what tags the post contains
		this.comment_id=result.rows[0].comment_id;
		resolveTags(this.tags,function(t){
			this.tagTotal=t.length;
			for (i in t){
				client.query("SELECT modifyPostTags($1, $2)",[this.post_id,t[i]],function(err,result){
					// Tag already exists for post
					this.tagTotal--;
					if (this.tagTotal==0){
						if (this.attachments.length>0){
							for (ii in this.attachments){
								client.query("INSERT INTO attachments (comment_id, attachment_url) VALUES($1, $2)",[this.comment_id, this.attachments[ii]],function(err,result){});
							}
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
		client.query("SELECT findTag($1)",[tags[i]],function(err,result){
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
		client.query("SELECT tag_name FROM tags WHERE tag_id=$1",[tags[i]],function(err,result){
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
	this.tags=[];
	client.query("SELECT post_tags.post_tags_id, tags.tag_name FROM tags INNER JOIN post_tags ON tags.tag_id = post_tags.tag_id;",function(err,result){
		for (i in result.rows){
			if (this.tags[result.rows[i].tag_name]==undefined){
				this.tags[result.rows[i].tag_name]=1;
			}else{
				this.tags[result.rows[i].tag_name]++;
			}
		}
		
		this.tags.sort();
		callback(Object.keys(this.tags));
	}.bind(this));
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
	
	client.query("UPDATE users SET avatar_url=$1 WHERE user_id=$2",[avatar_url,this.user.session.userId],function(){});
}

everyone.now.loadNavBar=function(){
	this.tags=[];
	client.query("SELECT * FROM navlinks WHERE user_id=$1",[this.user.session.userId],function(err,result){
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
		client.query("DELETE FROM navlinks WHERE tag_id=$1 AND user_id=$2",[tagIds[0],this.user.session.userId],function(err,result){});
	}.bind(this));
}

everyone.now.saveNavLink=function(tagName){
	if (this.user.session.userId==undefined){
		this.now.tagSaveError(1);
		return;
	}
	
	resolveTags([tagName],function(tagIds){
		client.query("INSERT INTO navlinks (tag_id, user_id) VALUES($1,$2)",[tagIds[0],this.user.session.userId],function(err,result){});
	}.bind(this));
}

everyone.now.getPopularTags=function(){
	generatePopularTags(function(tags){
		this.now.doPopularTags(tags);
	}.bind(this));
}

everyone.now.login=function(username,password){
	username=username.toLowerCase();
	client.query("SELECT * FROM users WHERE name=$1 AND password=$2",[username,md5(passHash.before+password+passHash.after)],function(err,result){
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
	client.query("SELECT name FROM users WHERE age(now(),last_active) < INTERVAL '10 minutes'",function(err,result){
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
	
	client.query("UPDATE users SET last_active=now() WHERE user_id=$1",[this.user.session.userId],function(){});
	
	this.now.pong();
}

everyone.now.signup=function(username,password,email){
	this.username=username.toLowerCase();
	this.email=email.toLowerCase();
	this.password=password;
	
	client.query("SELECT user_id FROM users WHERE name=$1",[username],function(err,result){
		var rows=result.rows;
		if (Object.keys(rows).length==0){
			// They don't exist :D
			client.query("INSERT INTO users (name, avatar_url, password, email) VALUES($1,'http://i.imgur.com/2KeOZ.png',$2,$3) RETURNING user_id",[this.username,md5(passHash.before+this.password+passHash.after),this.email],function(err,result){
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
		template: fs.readFileSync('./views/tag_page/partials/post.mustache','utf8')
	}
	
	if (attachments.length>0){
		// We've got attachments. Modify the post content.
		var tmp="";
		for (i in attachments){
			tmp+='<li class="span2"><a href="'+attachments[i]+'" class="thumbnail" rel="lightbox"><img src="'+attachments[i]+'" style="max-height:100px;" /></a></li>';
		}
		
		i++
		
		post.partials.post_content+='<br><br><small>Attachments <sup><span class="badge" onClick="toggleThumb(this);">'+i+'</span></sup></small><p><ul class="thumbnails" style="display: none;">';
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
		template: fs.readFileSync('./views/tag_page/partials/comment.mustache','utf8')
	}
	
	if (attachments.length>0){
		// We've got attachments. Modify the post content.
		var tmp="";
		for (i in attachments){
			tmp+='<li class="span2"><a href="'+attachments[i]+'" class="thumbnail" rel="lightbox"><img src="'+attachments[i]+'" style="max-height:100px;" /></a></li>';
		}
		
		i++;
		
		comment.partials.comment+='<br><br><small>Attachments <sup><span class="badge"onClick=" toggleThumb(this);">'+i+'</span></sup></small><p><ul class="thumbnails" style="display: none;">';
		comment.partials.comment+=tmp;
		comment.partials.comment+="</ul></p>";
	}
	
	this.now.commentResponse(1,post_id);
	postComment(comment.userId,post_id,content,tags,attachments,function(postId){
		this.postId=postId;
		everyone.now.newComment(this.postId,mustache.to_html(this.template,this.view,this.partials));
	}.bind(comment));
}

app.get('/version',function(req,res){
	res.end("DailyEntity Version "+versionNumber+" - "+codeName);
})

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