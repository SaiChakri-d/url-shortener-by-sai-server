import { client } from "./index.js";
import { ObjectId } from "mongodb";

export async function getUserByName(Email) {
  //db.users.findOne({username: username });
  return await client
    .db("urlShortener")
    .collection("users")
    .findOne({ Email: Email });
}
export async function getUserById(id) {
  //db.users.findOne({_id: id });
  return await client
    .db("urlShortener")
    .collection("users")
    .findOne({ _id: ObjectId(id) });
}

export async function createUser(data) {
  //db.users.insertOne(data);
  return await client
    .db("urlShortener")
    .collection("users")
    .insertOne(data);
}

export async function getUserByEmail(Email) {
  //db.users.findOne({username: username });
  return await client
    .db("urlShortener")
    .collection("users")
    .findOne({ Email: Email });
}
