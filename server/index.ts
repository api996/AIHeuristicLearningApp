import { server, ready } from "./app";
import { log } from "./vite";

await ready;

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;

server
  .listen({ port, host: "0.0.0.0" }, () => {
    log(`Server is now listening on port ${port}`);
  })
  .on("error", (err: any) => {
    log(`Failed to start server: ${err.message}`);
    throw err;
  });
