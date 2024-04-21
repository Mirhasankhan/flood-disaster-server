const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection URL
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function run() {
  try {
    // Connect to MongoDB
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db("floodDisaster");
    const usersCollection = db.collection("users");
    const supplyCollection = db.collection("supply");
    const applyCollection = db.collection("applications");

    // User Registration
    app.post("/api/v1/register", async (req, res) => {
      const { name, email, password, role } = req.body;

      // Check if email already exists
      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User already exists",
        });
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert user into the database
      await usersCollection.insertOne({
        name,
        email,
        role,
        password: hashedPassword,
      });

      res.status(201).json({
        success: true,
        message: "User registered successfully",
      });
    });

    // User Login
    app.post("/api/v1/login", async (req, res) => {
      const { email, password } = req.body;

      // Find user by email
      const user = await usersCollection.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Compare hashed password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Generate JWT token
      const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, {
        expiresIn: process.env.EXPIRES_IN,
      });

      res.json({
        success: true,
        message: "Login successful",
        email: req.body.email,
        token,
        role: user.role,
      });
    });

    app.get("/api/v1/users", async (req, res) => {
      let query = {};
      if (req.query?.role) {
        query = { role: req.query.role };
      }
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/api/v1/addSupply", async (req, res) => {
      const body = req.body;
      await supplyCollection.insertOne(body);
      res.status(201).json({
        success: true,
        message: "supply posted successfully",
      });
    });

    app.get("/api/v1/supplies", async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await supplyCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/api/v1/supplies/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await supplyCollection.find(filter).toArray();
      res.send(result);
    });

    app.put("/api/v1/supplies/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { isApplied } = req.body;

        if (!ObjectId.isValid(id))
          return res.status(400).json({ error: "Invalid ID format" });

        const filter = { _id: new ObjectId(id) };
        const update = { $set: { isApplied } };

        const result = await supplyCollection.updateOne(filter, update);

        if (result.modifiedCount === 0)
          return res.status(404).json({ error: "Supply not found" });

        res.json({ message: "Supply status updated successfully" });
      } catch (error) {
        console.error("Error updating supply status:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    app.delete("/api/v1/supplies/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = supplyCollection.deleteOne(filter);
      res.send(result);
    });

    //applications api
    app.post("/api/v1/addApply", async (req, res) => {
      const body = req.body;
      await applyCollection.insertOne(body);
      res.status(201).json({
        success: true,
        message: "applied successfully",
      });
    });

    app.get("/api/v1/applies", async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await applyCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/api/v1/deny/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = applyCollection.deleteOne(filter);
      res.send(result);
    });

    app.put("/api/v1/approve/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { isApproved } = req.body;

        if (!ObjectId.isValid(id))
          return res.status(400).json({ error: "Invalid ID format" });

        const filter = { _id: new ObjectId(id) };
        const update = { $set: { isApproved } };

        const result = await applyCollection.updateOne(filter, update);

        if (result.modifiedCount === 0)
          return res.status(404).json({ error: "Supply not found" });

        res.json({ message: "Supply status updated successfully" });
      } catch (error) {
        console.error("Error updating supply status:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // Start the server
    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });
  } finally {
  }
}

run().catch(console.dir);

// Test route
app.get("/", (req, res) => {
  const serverStatus = {
    message: "Server is running smoothly",
    timestamp: new Date(),
  };
  res.json(serverStatus);
});
