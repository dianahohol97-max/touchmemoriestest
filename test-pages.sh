#!/bin/bash

# Touch Memories - Public Pages Test Script
# Tests all public pages and reports status

BASE_URL="http://localhost:3000"
RESULTS_FILE="test-results.txt"

echo "🧪 Touch Memories - Public Pages QA Test" > $RESULTS_FILE
echo "=======================================" >> $RESULTS_FILE
echo "Started: $(date)" >> $RESULTS_FILE
echo "" >> $RESULTS_FILE

test_page() {
    local url=$1
    local name=$2

    echo -n "Testing $name... "

    status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$url" 2>&1)

    if [ "$status" = "200" ]; then
        echo "✅ PASS ($status)"
        echo "✅ $name - $url - Status: $status" >> $RESULTS_FILE
    elif [ "$status" = "404" ]; then
        echo "❌ FAIL ($status) - Page Not Found"
        echo "❌ $name - $url - Status: $status - NOT FOUND" >> $RESULTS_FILE
    elif [ "$status" = "500" ]; then
        echo "❌ FAIL ($status) - Server Error"
        echo "❌ $name - $url - Status: $status - SERVER ERROR" >> $RESULTS_FILE
    else
        echo "⚠️  WARN ($status)"
        echo "⚠️  $name - $url - Status: $status" >> $RESULTS_FILE
    fi
}

echo "🏠 Main Pages"
echo "" >> $RESULTS_FILE
echo "=== MAIN PAGES ===" >> $RESULTS_FILE

test_page "/" "Homepage"
test_page "/catalog" "Catalog Main"
test_page "/photobooks" "Photobooks"
test_page "/travelbook" "Travelbook"
test_page "/cart" "Shopping Cart"
test_page "/wishlist" "Wishlist"

echo ""
echo "=== STATIC PAGES ===" >> $RESULTS_FILE
echo "📄 Static Pages"

test_page "/pro-nas" "About Us (Про нас)"
test_page "/kontakty" "Contacts (Контакти)"
test_page "/oplata-i-dostavka" "Payment & Delivery"
test_page "/faq" "FAQ"
test_page "/sertyfikaty" "Certificates"
test_page "/hliantsevyi-zhurnal" "Calendar Journal"
test_page "/inshi-tovary" "Other Products"

echo ""
echo "=== BLOG PAGES ===" >> $RESULTS_FILE
echo "📝 Blog Pages"

test_page "/blog" "Blog Main"
test_page "/blog/category/photobooks" "Blog Category"
test_page "/blog/tag/tips" "Blog Tag"

echo ""
echo "=== AUTH PAGES ===" >> $RESULTS_FILE
echo "🔐 Authentication Pages"

test_page "/login" "Login"
test_page "/register" "Register"

echo ""
echo "=== ORDER PAGES ===" >> $RESULTS_FILE
echo "📦 Order Pages"

test_page "/track" "Track Order"
test_page "/checkout" "Checkout"

echo ""
echo "=== PHOTOBOOTH ===" >> $RESULTS_FILE
echo "📸 Photobooth"

test_page "/photobooth" "Photobooth Main"

echo ""
echo "=======================================" >> $RESULTS_FILE
echo "Completed: $(date)" >> $RESULTS_FILE
echo ""
echo "✨ Test completed! Check test-results.txt for details"
cat $RESULTS_FILE
