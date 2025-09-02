// Test script to verify progress tracking logic
// This simulates the stages and status checking to ensure accuracy

// Mock data structures
const testStages = [
  { id: 'analyzing', label: 'Analyzing Data Structure' },
  { id: 'generating_code', label: 'Generating PySpark Code' },
  { id: 'complete', label: 'Complete' }
];

// Test function that mimics getStageStatus logic
function testGetStageStatus(stageId, activeStage, stageStatus) {
  const currentIndex = testStages.findIndex(s => s.id === activeStage);
  const stageIndex = testStages.findIndex(s => s.id === stageId);
  
  console.log(`🔍 Testing Stage ${stageId}: activeStage=${activeStage}, stageStatus=${stageStatus}, currentIndex=${currentIndex}, stageIndex=${stageIndex}`);
  
  // Special handling for 'complete' stage
  if (stageId === 'complete') {
    if (activeStage === 'complete') {
      const status = stageStatus === 'completed' ? 'complete' : 'active';
      console.log(`🏁 Complete stage status: ${status}`);
      return status;
    } else {
      console.log(`⏳ Complete stage: pending (not at complete yet)`);
      return 'pending';
    }
  }
  
  if (stageId === activeStage) {
    const status = stageStatus === 'completed' ? 'complete' : 'active';
    console.log(`🎯 Current stage ${stageId} status: ${status}`);
    return status;
  } else if (stageIndex < currentIndex && currentIndex !== -1) {
    console.log(`✅ Previous stage ${stageId}: complete`);
    return 'complete';
  } else {
    console.log(`⏳ Future/unknown stage ${stageId}: pending`);
    return 'pending';
  }
}

// Test scenarios
console.log('\n=== Test Scenario 1: Starting analysis ===');
testStages.forEach(stage => {
  const status = testGetStageStatus(stage.id, 'analyzing', 'in_progress');
  console.log(`Stage ${stage.id}: ${status}`);
});

console.log('\n=== Test Scenario 2: Analysis completed, starting code generation ===');
testStages.forEach(stage => {
  const status = testGetStageStatus(stage.id, 'generating_code', 'in_progress');
  console.log(`Stage ${stage.id}: ${status}`);
});

console.log('\n=== Test Scenario 3: Code generation completed, moving to complete ===');
testStages.forEach(stage => {
  const status = testGetStageStatus(stage.id, 'complete', 'completed');
  console.log(`Stage ${stage.id}: ${status}`);
});

console.log('\n=== Test Scenario 4: PROBLEMATIC - Complete stage active but not completed yet ===');
testStages.forEach(stage => {
  const status = testGetStageStatus(stage.id, 'complete', 'in_progress');
  console.log(`Stage ${stage.id}: ${status}`);
});

console.log('\n=== Expected Results ===');
console.log('Scenario 1: analyzing=active, generating_code=pending, complete=pending');
console.log('Scenario 2: analyzing=complete, generating_code=active, complete=pending');
console.log('Scenario 3: analyzing=complete, generating_code=complete, complete=complete');
console.log('Scenario 4: analyzing=complete, generating_code=complete, complete=active (not green yet!)');
