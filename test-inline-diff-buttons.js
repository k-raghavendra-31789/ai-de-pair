// Test script to verify inline diff functionality
console.log('Testing inline diff functionality...');

// Function to simulate a code correction
function testInlineDiff() {
  // Find Monaco editor instance
  const editorContainer = document.querySelector('.monaco-editor');
  if (!editorContainer) {
    console.log('Monaco editor not found');
    return;
  }

  console.log('Monaco editor found');
  
  // Check if comparison widget exists
  const widget = document.querySelector('.inline-comparison-widget');
  if (widget) {
    console.log('Comparison widget found');
    
    // Test buttons
    const acceptBtn = widget.querySelector('.accept-diff-btn');
    const rejectBtn = widget.querySelector('.reject-diff-btn');
    
    if (acceptBtn) {
      console.log('Accept button found');
      acceptBtn.style.border = '2px solid yellow';
    }
    
    if (rejectBtn) {
      console.log('Reject button found');
      rejectBtn.style.border = '2px solid yellow';
    }
  } else {
    console.log('No comparison widget found');
  }
}

// Run test when page loads
window.addEventListener('load', () => {
  setTimeout(testInlineDiff, 2000);
});

// Export for manual testing
window.testInlineDiff = testInlineDiff;
