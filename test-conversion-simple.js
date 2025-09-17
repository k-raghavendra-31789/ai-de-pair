// Simple test for SQL conversion
// Create this in browser console to test:

async function testSQLConversion() {
  try {
    const testSQL = "SELECT * FROM customers WHERE id = 1";
    
    const response = await fetch('http://localhost:8000/api/v1/data/convert-sql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sqlCode: testSQL,
        sourceDialect: 'mysql',
        targetDialect: 'postgres'
      })
    });
    
    const data = await response.json();
    console.log('Conversion result:', data);
    
    if (data.status === 'success') {
      console.log('✅ Conversion successful');
      console.log('Converted SQL:', data.convertedSql);
      return data.convertedSql;
    } else {
      console.log('❌ Conversion failed:', data.message);
      return null;
    }
  } catch (error) {
    console.error('❌ Network error:', error);
    return null;
  }
}

// Run: testSQLConversion()
