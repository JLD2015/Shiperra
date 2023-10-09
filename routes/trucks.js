const express = require('express');
// eslint-disable-next-line

const router = express.Router();

router.get('/', (req, res) => {
  res.send('Trucks API is live');
});

module.exports = router;
