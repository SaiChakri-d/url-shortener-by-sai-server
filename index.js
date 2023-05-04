import express from "express";
import { MongoClient } from "mongodb";
import * as dotenv from "dotenv";
import jwt from "jsonwebtoken";
import cors from "cors";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import randomstring from "randomstring";
import {
  createUser,
  getUserByName,
  getUserByEmail,
  getUserById,
} from "./helper.js";
import { ObjectId } from "mongodb";
dotenv.config();


const app = express();
const PORT = process.env.PORT || 4000;
app.use(express.json());
app.use(cors());

const MONGO_URL = process.env.MONGO_URL;
async function createConnection() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  console.log("Mongo is connected ");
  return client;
}

export const client = await createConnection();

app.listen(PORT, () => console.log("Server started in port number:", PORT));

async function generateHashedPassword(password) {
  const NO_OF_ROUNDS = 10; //Number of rounds of salting
  const salt = await bcrypt.genSalt(NO_OF_ROUNDS);
  const hashedPassword = await bcrypt.hash(password, salt);
  return hashedPassword;
}
// express.json() is a inbuilt middleware to convert data inside body to json format.

function generateUrl() {
  let genresult = "";
  let char = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let charlength = char.length;
  for (let i = 0; i < 5; i++) {
    genresult += char.charAt(Math.floor(Math.random() * charlength));
  }

  return genresult;
}

async function check() {
  let shorturl = generateUrl();
  const isshortexist = await client
    .db("urlShortener")
    .collection("shortURLs")
    .findOne({ short: shorturl });

  if (isshortexist) {
    check();
  } else {
    return shorturl;
  }
}

app.get("/", function (req, res) {
  res.send("Hello, Welcome to the APP");
});

app.post("/signup", async function (request, response) {
  const { FirstName, LastName, Email, Password } = request.body;
  const userFromDB = await getUserByName(Email);

  if (userFromDB) {
    response.status(400).send({ message: "Username already exists" });
  } else {
    const hashedPassword = await generateHashedPassword(Password);
    //db.users.insertOne(data);
    const result = await createUser({
      FirstName: FirstName,
      LastName: LastName,
      Email: Email,
      Password: hashedPassword,
    });
    // response.send({message:"User Available"});
    const secret = process.env.SECRET_KEY;
    const payload = {
      Email: Email,
    };
    let token = jwt.sign(payload, secret, { expiresIn: "15m" });
    //  const addtoken= await addTokenInDb(email,token)
    const linkForUser = `${process.env.BACKEND_URL}/activatelink/${token}`;
    let transporter = nodemailer.createTransport({
      host: "smtppro.zoho.in",
      secure: true, // use SSL
      port: 465,
      auth: {
        // type: 'OAUTH2',
        user: process.env.MAIL_USERNAME,
        pass: process.env.MAIL_PASSWORD,
        // clientId: process.env.OAUTH_CLIENTID,
        // clientSecret: process.env.OAUTH_CLIENT_SECRET,
        // refreshToken: process.env.OAUTH_REFRESH_TOKEN
      },
    });
    //Mail options
    let mailOptions = {
      from: process.env.MAIL_USERNAME,
      to: Email,
      subject: "Activation link",
      html: `<h4>Hello User,</h4><br><p> You can activate the account by clicking the link below.</p><br><u><a href=${linkForUser}>${linkForUser}</a></u>`,
    };
    //Send mail
    transporter.sendMail(mailOptions, (err, data) => {
      if (err) {
        console.log(err);
      } else {
        console.log("email sent successfully");
      }
    });
    response.send({ message: "successful Signup" });
  }
});

app.get("/activatelink/:token", async (request, response, next) => {
  try {
    let token = request.params.token;
    jwt.verify(token, process.env.SECRET_KEY, async (err, decode) => {
      if (decode !== undefined) {
        const document = await client
          .db("urlShortener")
          .collection("users")
          .findOneAndUpdate(
            { Email: decode.Email },
            { $set: { activate: "activate" } }
          );
        response.json({ message: "Account activated" });
      } else {
        response.status(401).json({ message: "invalid token" });
      }
    });
  } catch (error) {
    console.log(error);
  }
});

app.post("/login", async function (request, response) {
  const { Email, Password } = request.body;
  const userFromDB = await getUserByName(Email);

  if (!userFromDB) {
    response.status(400).send({ message: "Invalid Credential" });
    return;
  } else {
    if (!userFromDB.activate) {
      response.status(401).send({ message: "account not activated" });
      return;
    }
    // check password
    const storedPassword = userFromDB.Password;
    const isPasswordMatch = await bcrypt.compare(Password, storedPassword);
    if (isPasswordMatch) {
      response.send({ message: "successful login" });
      // localStorage.setItem("currentUser",UserName);
    } else {
      response.status(400).send({ message: "Invalid Credential" });
      return;
    }
  }
});
app.post("/forgetPassword", async function (request, response) {
  const { Email } = request.body;
  const userFromDB = await getUserByEmail(Email);

  if (!userFromDB) {
    response.status(400).send({ message: "This is not a registered E-mail" });
  } else {
    //generate random string
    let randomString = randomstring.generate();

    //send a mail using nodemailer

    //Create Transporter
    const linkForUser = `${process.env.FRONTEND_URL}/reset-password/${userFromDB._id}/${randomString}`;
    let transporter = nodemailer.createTransport({
      host: "smtppro.zoho.in",
      secure: true, // use SSL
      port: 465,
      auth: {
        // type: 'OAUTH2',
        user: process.env.MAIL_USERNAME,
        pass: process.env.MAIL_PASSWORD,
        // clientId: process.env.OAUTH_CLIENTID,
        // clientSecret: process.env.OAUTH_CLIENT_SECRET,
        // refreshToken: process.env.OAUTH_REFRESH_TOKEN
      },
    });
    //Mail options
    let mailOptions = {
      from: process.env.MAIL_USERNAME,
      to: Email,
      subject: "Reset Password",
      html: `<h4>Hello User,</h4><br><p> You can reset the password by clicking the link below.</p><br><u><a href=${linkForUser}>${linkForUser}</a></u>`,
    };
    //Send mail
    transporter.sendMail(mailOptions, (err, data) => {
      if (err) {
        console.log(err);
      } else {
        console.log("email sent successfully");
      }
    });
    //Expiring date
    const expiresin = new Date();
    expiresin.setHours(expiresin.getHours() + 1);
    //store random string
    await client
      .db("urlShortener")
      .collection("users")
      .findOneAndUpdate(
        { Email: Email },
        {
          $set: {
            resetPasswordToken: randomString,
            resetPasswordExpires: expiresin,
          },
        }
      );
    //Close the connection
    response.send({
      message: "User exists and password reset mail is sent",
    });
  }
});

app.post("/verifyToken", async function (request, response) {
  const { id, token } = request.body;
  const userFromDB = await getUserById(id);
  const currTime = new Date();
  currTime.setHours(currTime.getHours());
  try {
    if (currTime <= userFromDB.resetPasswordExpires) {
      if (token === userFromDB.resetPasswordToken) {
        response.send({ message: "Changing Password Approved" });
      } else {
        response.status(400).send({ message: "Token not valid" });
      }
    } else {
      response.status(400).send({ message: "Time expired" });
    }
  } catch (error) {
    response.status(500).send({
      message: "Something went wrong!",
    });
  }
});

app.put("/changePassword", async function (request, response) {
  const { Password, id } = request.body;
  // const userFromDB = await getUserById(id);
  // if(!userFromDB){
  //   response.status(400).send({message:"Invalid Credential"});
  // }
  // else
  try {
    // check password
    const hashedPassword = await generateHashedPassword(Password);
    await client
      .db("urlShortener")
      .collection("users")
      .findOneAndUpdate(
        { _id: ObjectId(id) },
        { $set: { Password: hashedPassword } }
      );
    //db.users.insertOne(data);
    response.send({ message: "Password updated successfully" });
  } catch (error) {
    response.send({ message: "Unexpected error in password updation" });
  }
});

app.post("/createshorturl", async (request, response) => {
  const { long } = request.body;
  const isurlexist = await client
    .db("urlShortener")
    .collection("shortURLs")
    .findOne({ long: long });

  if (!isurlexist) {
    let dt = new Date();
    let fulldate = [];
    let date = dt.getDate();
    let month = dt.getMonth() + 1;
    let year = dt.getFullYear();

    fulldate.push(date);
    fulldate.push(month);
    fulldate.push(year);
    let short = await check();
    const result = await client
      .db("urlShortener")
      .collection("shortURLs")
      .insertMany([
        {
          long: long,
          short: short,
          visit: 0,
          createdAt: [{ date: date, month: month, year: year }],
        },
      ]);
    response.send(result);
    return;
  } else {
    response.status(400).send("url already exist ");
    return;
  }
});

app.get("/geturl", async (request, response) => {
  const filter = request.query;
  const result = await client
    .db("urlShortener")
    .collection("shortURLs")
    .find(filter)
    .toArray();
  response.send(result);
});

app.get("/geturl/:shortenurl", async (request, response) => {
  const { shortenurl } = request.params;
  const result = await client
    .db("urlShortener")
    .collection("shortURLs")
    .findOne({ short: shortenurl });

  if (result) {
    const result1 = await client
      .db("urlShortener")
      .collection("shortURLs")
      .findOneAndUpdate({ short: shortenurl }, { $inc: { visit: 1 } });

    response.redirect(result.long);
  }
});

// app.get("/geturl/monthlycount", async(request, response) => {
//   let dt=new Date();

//   let fulldate=[];
//   let date=dt.getDate();
//   let month=dt.getMonth()+1;
//   // let filter={createdAt.month:month}
//       const result = await client
//   .db("urlShortener")
//   .collection("shortURLs")
//   .find({},{arrayFilters:[{"createdAt[0].month":month}]});

// const result = await client
// .db("urlShortener")
// .collection("shortURLs")
// .find({}).toArray((err,data)=>{response.json(data)});

// response.send(result);
// response.send("h"),
// });
