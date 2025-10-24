echo ""
echo "REGISTRATION DEMO"

echo ""
echo "Testing Missing password:"
curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d '{"username":"test_user","email":"test@zq.com"}'
echo ""
echo "---"

echo ""
echo "Testing bad email: wrong email format"
curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d '{"username":"bad_email","email":"invalidemail","password":"test123"}'
echo ""
echo "---"

echo ""
echo "Testing Short password(at least 6): 123"
curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d '{"username":"short_pword","email":"short@test.com","password":"123"}'
echo ""
echo "---"

echo ""
echo "Correct registration complete:"
curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d '{"username":"John","email":"john.doe@gmail.com","password":"abc123#"}'