module.exports = async function handler(req, res) {
  const { brainDump } = req.body;

  // Simple test response (we'll upgrade this later)
  res.status(200).json({
    message: "API is working!",
    input: brainDump
  });
};