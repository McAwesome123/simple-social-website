const express = require("express");
const { json, urlencoded } = require("body-parser");
const { randomBytes } = require("crypto");
const  cookies = require("cookie-parser");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const db = require("../db.json");
const port =  process.env.PORT || 3000;
const app = express();

// Store
const store = {
  users: db.users,
  socialPosts: db.socialPosts,
  sessions: db.sessions,
};

app.use(json()); // for parsing application/json
app.use(urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(
  cors({
    origin: "*",
  })
  );
app.use(cookies());

const checkAuth = (req, res, next) => {
//   const { sessionId } = req.cookies;
//   if (!sessionId) {
//     return res.status(401).send({ error: "SessionId is required" });
//   }
// 
//   const { sessions } = store;
//   const session = sessions.find(session => session.id === sessionId);
//   if (!session) {
//     return res.status(401).send({ error: 'Not authorized'});
//   }
// 
//   req.userId = session.userId;
  next();
};

const updateDb = (newUsers, newPosts, newSessions) => {
  const { users, socialPosts, sessions } = store;
  const db = {
    users: newUsers || users,
    socialPosts: newPosts || socialPosts,
    sessions: newSessions || sessions,
  };

  store.socialPosts = db.socialPosts;
  store.users = db.users;
  store.sessions = db.sessions;

  const filePath = path.join(__dirname, "../db.json");
  const data = JSON.stringify(db, null, 2);
  fs.writeFileSync(filePath, data);
}


const addToSessions = (session) => {
  const { sessions } = store;
  sessions.push(session);
  updateDb(null, null, sessions);
};

const removeFromSessions = (sessionId) => {
  const { sessions } = store;
  const newSessions = sessions.filter(session => session.id !== sessionId);
  updateDb(null, null, newSessions);
};

app.get('/', (req, res) => res.sendFile('index.html', {root: __dirname }));

app.get('/register', (req, res) => res.sendFile('register.html', {root: __dirname }));

app.get('/login', (req, res) => res.sendFile('login.html', {root: __dirname }));

// register
app.post("/register", (req, res) => {
  const { name } = req.body;

  if (!name) return res.status(400).send({ error: "Name is required" });

  if (store.users.find(user => user.name === name)) {
    return res.status(400).send({ error: "User already exists" });
  }

  const user = {
    id: randomBytes(16).toString("hex"),
    name,
  };

  const { users } = store;
  users.push(user);
  updateDb(users);
  res.redirect(201, "/");
});

app.post("/login", (req, res) => {
  const { name } = req.body;
  const { users } = store;
  const user = users.find(user => user.name === name);
  if (!user) {
    return res.status(404).send({ error: "User not found" });
  }

  if (store.sessions.find(session => session.userId === user.id)) {
    return res.status(400).send({ error: "User already logged in" });
  }

  const session = {
    id: randomBytes(16).toString("hex"),
    userId: user.id,
  };

  addToSessions(session);
  res.cookie("sessionId", session.id, { httpOnly: true });
  res.redirect(201, "/");
});

app.post("/logout", (req, res) => {
  const { sessionId } = req.cookies;
  console.log({ sessionId });
  if (!sessionId) {
    return res.status(400).send({ error: "SessionId is required" });
  }

  const { sessions } = store;
  const session = sessions.find(session => session.id === sessionId);
  if (!session) {
    return res.status(404).send({ error: "Session not found" });
  }

  removeFromSessions(sessionId);
  res.clearCookie("sessionId");
  res.status(201).send();
});

app.get("/posts", checkAuth, (req, res) => {
  const { socialPosts } = store;

  const posts = socialPosts.map(post => {
    const { users } = store;
    const user = users.find(user => user.id === post.userId);
    postCopy = { ...post };
    postCopy.userName = user.name;
    postCopy.likes = postCopy.likes?.length ?? 0;
    delete postCopy.userId;
    return postCopy;
  });

  res.send(posts);
});

app.get("/posts/:id", checkAuth, (req, res) => {
  const { id } = req.params;
  const { socialPosts } = store;
  const post = socialPosts.find(post => post.id === id);
  if (!post) {
    return res.status(404).send();
  }

  res.send(post);
});

app.get("/posts/:id/like", checkAuth, (req, res) => {
  // like a post
  const { id } = req.params;
  const { socialPosts } = store;
  const post = socialPosts.find(post => post.id === id);
  if (!post) {
    return res.status(404).send();
  }

  const { likes } = post;
  const { userId } = req;
  if (likes.includes(userId)) {
    return res.status(400).send({ error: "Post already liked" });
  }

  likes.push(userId);
  updateDb(null, socialPosts);
  res.status(201).send();
});

app.post("/posts", checkAuth, (req, res) => {
  const { userId } = req;
  const { content } = req.body;
  if (!content) {
    return res.status(400).send({ error: "Content is required" });
  }

  const post = {
    id: randomBytes(16).toString("hex"),
    userId,
    content,
    likes: [],
  };

  const { socialPosts } = store;
  socialPosts.push(post);
  updateDb(null, socialPosts);
  res.status(201).send(post);
});

app.delete("/posts/:id", checkAuth, (req, res) => {
  const { id } = req.params;
  const { socialPosts } = store;
  const post = socialPosts.find(post => post.id === id);

  if (!post) {
    return res.status(404).send();
  }

  if (post.userId !== req.userId) {
    return res.status(401).send({ error: "Not authorized" });
  }
  

  const newPosts = socialPosts.filter(post => post.id !== id);
  updateDb(null, newPosts);
  res.status(201).send();
});

app.listen(port, () => {
  console.log(`Simple Social Media API listening on port ${port}!`);
});