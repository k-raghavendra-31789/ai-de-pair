-- Test the simplified SQL formatter

-- ORIGINAL (POORLY FORMATTED)
SELECT lineitem.l_orderkey AS order_key, orders.o_orderdate AS order_date, orders.o_custkey AS cust_key, lineitem.l_partkey AS part_key, lineitem.l_suppkey AS supp_key, lineitem.l_quantity AS quantity, lineitem.l_extendedprice AS extended_price, lineitem.l_discount AS discount, (lineitem.l_extendedprice * (1 - lineitem.l_discount)) AS total_price FROM delta.`dbfs:/databricks-datasets/tpch/delta-001/lineitem/` AS lineitem LEFT OUTER JOIN delta.`dbfs:/databricks-datasets/tpch/delta-001/orders/` AS orders ON lineitem.l_orderkey = orders.o_orderkey;

-- The formatter should convert this to:

SELECT
    lineitem.l_orderkey AS order_key,
    orders.o_orderdate AS order_date,
    orders.o_custkey AS cust_key,
    lineitem.l_partkey AS part_key,
    lineitem.l_suppkey AS supp_key,
    lineitem.l_quantity AS quantity,
    lineitem.l_extendedprice AS extended_price,
    lineitem.l_discount AS discount,
    (lineitem.l_extendedprice * (1 - lineitem.l_discount)) AS total_price
FROM delta.`dbfs:/databricks-datasets/tpch/delta-001/lineitem/` AS lineitem
    LEFT OUTER JOIN delta.`dbfs:/databricks-datasets/tpch/delta-001/orders/` AS orders
        ON lineitem.l_orderkey = orders.o_orderkey;
