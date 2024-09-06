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
const encrypt = require("mongoose-encryption");

mongoose.connect('mongodb://' + mongoId + ':' + mongoPw + '@cluster0-shard-00-00.srjz5.mongodb.net:27017,cluster0-shard-00-01.srjz5.mongodb.net:27017,cluster0-shard-00-02.srjz5.mongodb.net:27017/' + mongodbName + '?ssl=true&replicaSet=atlas-ql15hw-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0')
    .then(() => console.log('MongoDB 连接成功'))
    .catch((err) => console.error('MongoDB 连接失败:', err));

const app = express();

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true}));
app.use(express.static("public"));

const userSchema = new mongoose.Schema({
    email: String,
    password: String
});

const secret = process.env.SECRETSTRING;
userSchema.plugin(encrypt, { secret: secret, encryptedFields: ["password"] });//要写在model之前，因为之后用userSchema的时候，需要这个plugin来暗号化密码,因为email不需要密码所以要指定password

const User = mongoose.model("User", userSchema);



app.get("/", (req, res) => {
    res.render("home");
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.get("/register", (req, res) => {
    res.render("register");
});

app.post("/register", (req, res) => {
    const newUser = new User({
        email: req.body.username,
        password: req.body.password
    });
    newUser.save()
        .then(() =>{
            console.log("Successfully registered: ", newUser.email, newUser.password);
            res.render("secrets");
        })
        .catch((err) => console.error("ERROR REGISTER: ", err));
});

app.post("/login", (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    User.findOne({email: username})
        .then((foundUser) => {
            if(password === foundUser.password) {
                console.log(foundUser.email + " がログインしました。");
                res.render("secrets");
            } else {
                res.send("Username or Password is Not Match");
            }
        })
        .catch((err) => console.error(err));
});






app.listen(3000, () => {
    console.log("Server started on port 3000")
});