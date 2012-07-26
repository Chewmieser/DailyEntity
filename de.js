// DailyEntity Backend v1.0
// Actual version: 3.0
// Codename: Chocolate Chip Cheesecake
// 7/2012

var versionNumber="1.0";
var codeName="Chocolate Chip Cheesecake";

// Load libs
var express=require("express"); // Routing
var mysql=require("mysql"); // DB

var pg=require('pg'); // New DB

var mustache=require('mustache'); // Template
var fs=require("fs");
var path=require("path");
var nowjs=require("now");

// Create server, connect to MySQL
var app=express.createServer();
app.use(express.logger('dev'));
app.use(express.cookieParser());

var MemoryStore=express.session.MemoryStore;
var sessionStore=new MemoryStore({reapInterval: 60000 * 10});
app.use(express.session({secret: "de123dezxc", store: sessionStore}));

app.listen(3000);

var passHash={
	before: "de{crazy}",
	after: "12deFunlol1z"
}

var everyone=nowjs.initialize(app);

var connection=mysql.createConnection({
	host:'0.0.0.0',
	user:'root'
});
connection.connect();
connection.query('USE dailyentity');

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
	connection.query("SELECT id,tag_description FROM tags WHERE tag_name=?",tag,function(err,rows,fields){
		// If there is no tag ID, create the tag
		if (Object.keys(rows).length==0){
			// Send the tag page
			connection.query("INSERT INTO tags VALUES('',?,'')",tag,function(err,result){
				debug(DEBUG_INFO,"Tag '"+tag+"' created");
				sendTagPage(this.clientId);
			}.bind(this)); // Pass context of 'this' into function
		}else{
			// Grab the tag
			var tagId=rows[0].id;
			
			global.client[this.clientId].page_data.tag_data.id=rows[0].id;
			global.client[this.clientId].page_data.tag_data.description=rows[0].tag_description;

			// Find relevant post IDs
			connection.query("SELECT post_id FROM post_tags WHERE tag_id="+rows[0].id+" ORDER BY id DESC",function(err,rows,fields){
				// If we have posts available, grab them
				if (Object.keys(rows).length>0){
					for (var r in Object.keys(rows)){
						global.client[this.clientId].page_data.total_posts++;
						connection.query({sql: "SELECT * FROM posts LEFT JOIN users ON posts.user_id=users.id WHERE posts.id="+rows[r].post_id, nestTables: true},function(err,rows,fields){
							var pid=global.client[this.clientId].page_data.posts.push({
								post: rows[0].posts.post,
								user_id: rows[0].posts.user_id,
								post_id: rows[0].posts.id,
								user_name: rows[0].users.name,
								avatar_url: rows[0].users.avatar_url
							})-1;
							
							var tmp={
								clientId: this.clientId,
								pid: pid
							}
							
							connection.query({sql: "SELECT * FROM comments LEFT JOIN users ON comments.user_id=users.id WHERE post_id="+rows[0].posts.id, nestTables: true},function(err,rows,fields){
								var tmp=[];
								
								for (i in rows){
									var curr=tmp.push(rows[i].comments)-1;
									tmp[curr].user_name=rows[i].users.name;
									tmp[curr].user_id=rows[i].users.id;
									tmp[curr].avatar_url=rows[i].users.avatar_url;
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

	//if (global.client[clientId].resource_id.session.userId!=null){
		//v.user_name=global.client[clientId].resource_id.session.user_name;
	//}
	
	var p={
		navbar_links: "",
		notifications: "",
		account_menu: "<form style='padding-left:5px;padding-right:5px;'><div class='control-group' id='logincontrols'><li><input id='loginUsername' type='text' placeholder='username'></li><li><input id='loginPass' type='password' placeholder='password'></li></div><li><button id='signupButton' onClick='modifyLogin()' class='btn'>sign up</button><button id='loginSubmit' onClick='loginUser()' class='btn btn-primary pull-right'>login</button></li></form>"
	}
	
	if (global.client[clientId].request.session.userId!=undefined){
		console.log("User already logged in!");
		p.account_menu="<li><a href='#'>Profile</a></li><li class='divider'></li><li><a href='#'>Sign out</a></li>";
		v.user_name=global.client[clientId].request.session.username;
	}
	
	// If client session exists...
	// <li><a href="#">Profile</a></li>
	// <li class="divider"></li>
	// <li><a href="#">Sign out</a></li>
	
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
				user_name: global.client[clientId].page_data.posts[i].user_name
			}
			
			var p={
				post_content: global.client[clientId].page_data.posts[i].post,
				comments: ""
			}
			
			for (ii in global.client[clientId].page_data.posts[i].comments){
				var vv={
					user_name: global.client[clientId].page_data.posts[i].comments[ii].user_name,
					avatar_url: global.client[clientId].page_data.posts[i].comments[ii].avatar_url
				}
				
				var pp={
					comment: global.client[clientId].page_data.posts[i].comments[ii].comment
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

function postContent(user_id,content,tags,callback){
	this.tags=tags;
	connection.query("INSERT INTO posts VALUES('',?,?,now())",[content,user_id],function(err,result){
		this.postId=result.insertId;
		this.tagTotal=tags.length;
		
		resolveTags(tags,function(t){
			for (i in t){
				connection.query("INSERT INTO post_tags VALUES('',?,?)",[this.postId,t[i]],function(err,rows,fields){
					this.tagTotal--;

					if (this.tagTotal==0){
						callback(this.postId);
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
		connection.query("SELECT id FROM tags WHERE tag_name=?",tags[i],function(err,rows,fields){
			this.resolved.push(rows[0].id);
			this.totalTags--;
			
			if (this.totalTags==0){
				callback(this.resolved);
			}
		}.bind(this));
	}
}

// Opening a tag page
app.get('/tag/*',function(req,res){
	var clientId=createClient(req,res);
	loadTagPage(clientId);
});

app.get('/test',function(req,res){
	postContent(1,"Hello worldzzzz",["atgar","bacon"],null);
	
	res.end();
});

everyone.now.login=function(username,password){
	username=username.toLowerCase();
	connection.query("SELECT * FROM users WHERE name=? AND password=?",[username,password],function(err,rows,fields){
		
		if (Object.keys(rows).length==0){
			this.now.loginResponse(false,{});
		}else{
			
			delete rows[0].password;
			
			this.user.session.userId=rows[0].id;
			this.user.session.username=rows[0].name;
			this.user.session.avatar_url=rows[0].avatar_url;
			this.now.loginResponse(true,rows[0]);
			this.user.session.save();
		}
	}.bind(this));
}

everyone.now.signup=function(username,password,email){
	this.username=username.toLowerCase();
	this.email=email.toLowerCase();
	connection.query("INSERT INTO users VALUES('',?,'http://i.imgur.com/2KeOZ.png',?,?)",[username,password,email],function(err,result){
		this.user.session.userId=result.insertId;
		this.user.session.username=this.username;
		this.user.session.avatar_url='http://i.imgur.com/2KeOZ.png';
		
		var userObject={
			id: result.insertId,
			name: this.username,
			avatar_url: 'http://i.imgur.com/2KeOZ.png',
			email: this.email
		}
		
		this.now.loginResponse(true,userObject);
		this.user.session.save();
	}.bind(this));
}

everyone.now.test=function(mess){
	console.log(mess);
}

everyone.now.postMessage=function(content,tags){
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
	
	postContent(post.userId,content,tags,function(postId){
		this.postId=postId;
		everyone.now.newPost(mustache.to_html(this.template,this.view,this.partials));
	}.bind(post));
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
		res.end();
	}
});