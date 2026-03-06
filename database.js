const mongoose = require("mongoose");
const app = require("./app");
const dotenv = require("dotenv");
const dns = require("dns");

// Forzar uso de DNS de Google para resolver dominios externos (MongoDB Atlas)
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

dotenv.config();

const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.MONGO_URL;

mongoose.connect(MONGO_URL)
  .then(() => {
    console.log("✅ Conectado a MongoDB correctamente");
    app.listen(PORT, () => {
      console.log("#####################");
      console.log("##### API REST #####");
      console.log("#####################");
      console.log(`🚀 Servidor escuchando en el puerto http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Error al conectar a MongoDB:", err);
    process.exit(1);
  });
