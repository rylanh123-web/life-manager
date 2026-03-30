export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  return res.status(200).json({
    id: `family-${Date.now()}`,
    code: "ABC123",
    members: [token.replace("-token", "")]
  });
}
