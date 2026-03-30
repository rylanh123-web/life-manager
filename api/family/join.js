export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = req.headers.authorization;
  const { code } = req.body || {};

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (!code) {
    return res.status(400).json({ error: "Family code required" });
  }

  return res.status(200).json({
    id: `family-${Date.now()}`,
    code,
    members: [token.replace("-token", "")]
  });
}
