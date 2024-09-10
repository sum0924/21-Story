//jshint esversion:6
// 在应用程序的最顶部加载 dotenv
require('dotenv').config();
const mongoId = process.env.MONGOID;
const mongoPw = process.env.MONGOPW;
const mongodbName = process.env.MONGODBNAME

const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");

const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require('mongoose-findorcreate');
const FacebookStrategy = require("passport-facebook").Strategy;

mongoose.connect('mongodb://' + mongoId + ':' + mongoPw + '@cluster0-shard-00-00.srjz5.mongodb.net:27017,cluster0-shard-00-01.srjz5.mongodb.net:27017,cluster0-shard-00-02.srjz5.mongodb.net:27017/' + mongodbName + '?ssl=true&replicaSet=atlas-ql15hw-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0')
    .then(() => console.log('MongoDB 连接成功'))
    .catch((err) => console.error('MongoDB 连接失败:', err));

const app = express();

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true}));
// 解析 JSON 数据
app.use(bodyParser.json());
app.use(express.static("public"));

app.use(session({
    secret: process.env.SESSION_SECRET, // 从环境变量中读取 secret
    resave: false,
    saveUninitialized: false
  }));

app.use(passport.initialize());
app.use(passport.session());

// app.use((req, res, next) => {
//     res.locals.user = req.user;
//     next();
//   });


const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    facebookId: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model("User", userSchema);

//passport-local-mongoose,下面3句要写在运用model之下
passport.use(User.createStrategy());

//passport-local-mongoose是用以下注释代码
//报错：Error: Failed to serialize user into session
// passport.serializeUser(User.serializeUser());
// passport.deserializeUser(User.deserializeUser());

//修改后
passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, {
        id: user.id,
        username: user.username,
        picture: user.picture
      });
    });
  });
  
  passport.deserializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, user);
    });
  });


passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    // 读取用户的 email 地址
    // const email = profile.emails[0].value; // Google 用户的 email 地址
    // console.log("User email:", email); // 输出 email 地址到控制台
    console.log(profile);

    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));


passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "http://localhost:3000/auth/facebook/secrets",
    profileFields: ['id', 'emails', 'name']  // 获取用户的 email, 名字等信息
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ facebookId: profile.id }, function (err, user) {
      if (err) { return cb(err); }
      // 可以存储更多用户信息，例如：
        user.email = profile.emails[0].value;
        user.name = profile.name.givenName + ' ' + profile.name.familyName;
        user.save();
        return cb(null, user);
    });
  }
));




app.get("/", (req, res) => {
    res.render("home");
});

// 发起 Google OAuth 的路由
app.get("/auth/google", 
    passport.authenticate("google", { scope: ["profile"] })
);

// 用户认证成功后，Google 会重定向到此路由
app.get("/auth/google/secrets", 
    passport.authenticate("google", { failureRedirect: "/login" }),
    function(req, res) {
        // 认证成功，重定向到 secrets 页面
        res.redirect("/secrets");
    }
);

// 发起 Facebook OAuth 的路由
app.get('/auth/facebook',
    passport.authenticate('facebook', { scope: ["email"]})
);
// 处理 Facebook 登录后的回调
app.get('/auth/facebook/secrets',
    passport.authenticate('facebook', { failureRedirect: '/login' }),
    function(req, res) {
        // Successful authentication, redirect home.
        res.redirect('/secrets');
});



app.get("/login", (req, res) => {
    res.render("login");
});

app.get("/register", (req, res) => {
    res.render("register");
});


app.get("/secrets", (req, res) => {
    if (req.isAuthenticated()) {
        res.render("secrets");
    } else {
        res.redirect("/login");
    }
});

app.get("/logout", (req, res) => {
    if (req.isAuthenticated()) {
        const username = req.user.username; // Capture the username before logout
        req.logout(function(err) {
            if (err) { return next(err); }
            console.log(`${username} has logged out.`); // Log the username
            res.redirect('/');
        });
    } else {
        res.redirect('/');
    }
});


app.get("/privacy", (req, res) => {
    res.render("privacy");
});

app.get("/delete-user-data", (req, res) => {
    res.render("delete-user-data");
});

app.post("/register", (req, res) => {
    User.register({username: req.body.username}, req.body.password, function(err, user) {
        if (err) {
            console.log(err);
            res.redirect("/register");
        } else {
            passport.authenticate("local")(req, res, function() {
                res.redirect("/secrets");
                console.log(req.body.username, " が登録しました。");
            });
        }
    });

    
});

app.post("/login", (req, res) => {
    
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user, function(err) {
        if (err) {
            console.log(err);
        } else {
            passport.authenticate("local")(req, res, function() {
                res.redirect("/secrets");
                console.log(user.username, " がログインしました。")
            });
        }
    });
});

// 用户数据删除回调的端点
app.post('/delete-user-data', (req, res) => {
    // 获取请求中的用户 ID
    const userId = req.body.user_id;
    
    if (!userId) {
        return res.status(400).send('User ID is required.');
    }

    // 在这里实现删除用户数据的逻辑
    // 例如，从数据库中删除用户数据
    // db.users.deleteOne({ _id: userId });

    console.log(`User data deletion requested for user ID: ${userId}`);

    // 返回成功响应
    res.status(200).send('User data deletion request received.');
});





app.listen(3000, () => {
    console.log("Server started on port 3000")
});