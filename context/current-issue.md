1. There is a huge confusion between the customer login and admin login due to which both have same dashboard

Change - http://localhost:3000/sign-in --> http://localhost:3000/customer/sign-in 

2. after login in the CSR portal; we get the page of http://localhost:3000/editor instead it should be http://localhost:3000/admin/dashboard

3. even after login as customer i see the same portal taking me to link http://localhost:3000/editor  instead it should be http://localhost:3000/customer/dashboard

4. both admin and customer dashboard are not opened at once. If I login in admin then customer dashboard is logout immediately and wise-versa. I want to simmantenously work together as seperate in different window. so I can show the live demo between customer and admin dashboard 