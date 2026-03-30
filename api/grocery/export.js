export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { store } = req.query || {};

  return res.status(200).json({
    store: store || "generic",
    items: [
      "chicken breast",
      "rice",
      "broccoli",
      "milk",
      "eggs"
    ]
  });
}
