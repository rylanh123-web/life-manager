export default function handler(req, res) {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  // Very basic token decoding (matches our fake auth)
  const email = token.replace("-token", "");

  return res.status(200).json({
    id: email,
    email
  });
}
