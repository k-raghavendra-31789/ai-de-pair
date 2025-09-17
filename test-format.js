// Test the SQL formatter with the provided SQL
const { formatSQLText } = require('./src/components/MonacoEditor.js');

const badSQL = `SELECT lineitem.l_orderkey AS order_key, orders.o_orderdate AS order_date, orders.o_custkey AS cust_key, lineitem.l_partkey AS part_key, lineitem.l_suppkey AS supp_key, lineitem.l_quantity AS quantity, lineitem.l_extendedprice AS extended_price, lineitem.l_discount AS discount, (lineitem.l_extendedprice * (1 - lineitem.l_discount
    )
) AS total_price
FROM delta.\`dbfs:/databricks-datasets/tpch/delta-001/lineitem/\` AS lineitem LEFT OUTER
JOIN delta.\`dbfs:/databricks-datasets/tpch/delta-001/orders/\` AS orders ON lineitem.l_orderkey = orders.o_orderkey;`;

console.log('=== ORIGINAL (POORLY FORMATTED) ===');
console.log(badSQL);

console.log('\n=== PROPERLY FORMATTED ===');
const formatted = formatSQLText(badSQL);
console.log(formatted);
