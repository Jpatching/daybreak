// Set test environment variables before any imports
process.env.HELIUS_API_KEY = 'test-helius-key';
process.env.JWT_SECRET = 'test-jwt-secret-64chars-0000000000000000000000000000000000000000';
process.env.BOT_API_KEY = 'test-bot-key-123';
process.env.PORT = '0'; // random port for tests
process.env.TREASURY_WALLET = '5rSwWRfqGvnQaiJpW3sb3YKLbxtjVxgc4yrvrHNeNwE2';
process.env.X402_NETWORK = 'solana-devnet';
process.env.X402_PRICE_USD = '0.01';
