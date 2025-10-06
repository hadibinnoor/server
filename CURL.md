curl --location 'http://3.27.134.232:3000/auth/login' \
--header 'Content-Type: application/json' \
--data '{
    "username": "admin",
    "password": "admin123"
}'

============================================

http://3.27.134.232:3000/health

http://3.27.134.232:3000/auth/login POST
{
    "username": "admin",
    "password": "admin123"
}

http://3.27.134.232:3000/jobs/upload POST