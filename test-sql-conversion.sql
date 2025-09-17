SELECT 
    customer_id,
    customer_name,
    order_date,
    total_amount
FROM customers c
JOIN orders o ON c.id = o.customer_id
WHERE order_date >= '2023-01-01'
ORDER BY order_date DESC;
