echo "+ installing packages"
npm install

echo "+ building package"
zip -9 -q -r --exclude=*faker* --exclude=*.DS_Store* --exclude=*test.js* lambda.zip .

echo "+ deploying to aws"
aws lambda update-function-code --function-name contentful-wehbook --zip-file fileb://lambda.zip
