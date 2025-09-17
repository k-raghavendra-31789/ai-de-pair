SELECT 
    customer_id,
    customer_name,
    COUNT(*) as order_count,
    SUM(total_amount) as total_spent,
    MAX(order_date) as last_order_date
FROM customers c
JOIN orders o ON c.id = o.customer_id
WHERE order_date >= DATE('2023-01-01')
GROUP BY customer_id, customer_name
HAVING COUNT(*) > 5
ORDER BY total_spent DESC
LIMIT 10;
