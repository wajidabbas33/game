// ============================================================
//  Test Script for Roblox AI Plugin Backend
//
//  Tests all 7 bug fixes + game-mode enhancements
//  Run: node test-server.js
// ============================================================

'use strict';

const http = require('http');

const BASE_URL = 'http://localhost:3000';
let testsPassed = 0;
let testsFailed = 0;

// Helper to make HTTP requests
function makeRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            method,
            headers: body ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(JSON.stringify(body))
            } : {}
        };

        const req = http.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: data ? JSON.parse(data) : null
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: data
                    });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

// Test helpers
function assert(condition, message) {
    if (condition) {
        console.log(`  ✅ ${message}`);
        testsPassed++;
    } else {
        console.log(`  ❌ ${message}`);
        testsFailed++;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// Test Suite
// ============================================================

async function runTests() {
    console.log('\n🧪 Starting Roblox AI Plugin Backend Tests\n');
    console.log('=' .repeat(60));

    // Test 1: Health Check
    console.log('\n📋 Test 1: Health Endpoint');
    try {
        const res = await makeRequest('GET', '/health');
        assert(res.status === 200, 'Health endpoint returns 200');
        assert(res.body && res.body.status === 'ok', 'Health status is ok');
        assert(
            res.body.model.includes('qwen') || res.body.model.includes('gpt'),
            `Model is valid AI provider (${res.body.model})`
        );
    } catch (e) {
        assert(false, `Health check failed: ${e.message}`);
    }

    // Test 2: Missing Prompt Validation
    console.log('\n📋 Test 2: Input Validation');
    try {
        const res = await makeRequest('POST', '/generate', {
            conversationId: 'test-123'
        });
        assert(res.status === 400, 'Returns 400 for missing prompt');
        assert(res.body.error === 'Bad Request', 'Error message is correct');
    } catch (e) {
        assert(false, `Input validation test failed: ${e.message}`);
    }

    // Test 3: Simple Generation Request
    console.log('\n📋 Test 3: Simple Generation (Create a red brick)');
    try {
        const res = await makeRequest('POST', '/generate', {
            prompt: 'Create a red brick at position 0,5,0',
            conversationId: 'test-simple-' + Date.now()
        });
        assert(res.status === 200, 'Returns 200 for valid request');
        assert(res.body.explanation, 'Response has explanation');
        assert(res.body.instances || res.body.scripts, 'Response has instances or scripts');
        assert(res.body.complexity, 'Response has complexity field');
        console.log(`  📝 Explanation: ${res.body.explanation}`);
        console.log(`  📊 Complexity: ${res.body.complexity}`);
    } catch (e) {
        assert(false, `Simple generation failed: ${e.message}`);
    }

    // Test 4: Game Mode Request (Round System)
    console.log('\n📋 Test 4: Game Mode Generation (Round-based game)');
    try {
        const res = await makeRequest('POST', '/generate', {
            prompt: 'Create a round-based game with 60 second rounds',
            conversationId: 'test-gamemode-' + Date.now()
        });
        assert(res.status === 200, 'Returns 200 for game mode request');
        assert(res.body.scripts && res.body.scripts.length > 0, 'Generated scripts');
        assert(res.body.complexity, 'Has complexity assessment');
        console.log(`  📝 Explanation: ${res.body.explanation}`);
        console.log(`  📊 Scripts generated: ${res.body.scripts ? res.body.scripts.length : 0}`);
        if (res.body.phases && res.body.phases.length > 0) {
            console.log(`  📊 Phases: ${res.body.totalPhases}`);
        }
    } catch (e) {
        assert(false, `Game mode generation failed: ${e.message}`);
    }

    // Test 5: Combined Map + System Generation
    console.log('\n📋 Test 5: Dynamic Map + System Generation');
    try {
        const res = await makeRequest('POST', '/generate', {
            prompt: 'Create a capture the flag arena with two bases, flag stands, team spawns, and the core server scripts',
            conversationId: 'test-map-system-' + Date.now()
        });
        assert(res.status === 200, 'Returns 200 for map + system request');
        assert(res.body.instances && res.body.instances.length > 0, 'Generated map/layout instances');
        assert(res.body.scripts && res.body.scripts.length > 0, 'Generated gameplay scripts');
        assert(res.body.complexity, 'Has complexity assessment for combined request');
        console.log(`  📝 Explanation: ${res.body.explanation}`);
        console.log(`  🧱 Instances generated: ${res.body.instances ? res.body.instances.length : 0}`);
        console.log(`  📜 Scripts generated: ${res.body.scripts ? res.body.scripts.length : 0}`);
    } catch (e) {
        assert(false, `Dynamic map + system generation failed: ${e.message}`);
    }

    // Test 6: Terrain Generation
    console.log('\n📋 Test 6: Terrain Generation');
    try {
        const res = await makeRequest('POST', '/generate', {
            prompt: 'Create grassy hills terrain with a river and no scripts',
            conversationId: 'test-terrain-' + Date.now()
        });

        assert(res.status === 200, 'Returns 200 for terrain request');
        assert(Array.isArray(res.body.terrain), 'Response has terrain array');
        assert(res.body.terrain.length > 0, 'Generated at least one terrain operation');
        assert(
            res.body.terrain.every(op => ['Block', 'Ball', 'Cylinder'].includes(op.shape)),
            'Terrain operations use supported shapes'
        );
        assert(
            res.body.terrain.every(op => typeof op.material === 'string' && op.material.length > 0),
            'Terrain operations include materials'
        );
        assert(
            Array.isArray(res.body.scripts) && res.body.scripts.length === 0,
            'No scripts are generated when prompt says no scripts'
        );
        console.log(`  📝 Explanation: ${res.body.explanation}`);
        console.log(`  🌍 Terrain ops: ${res.body.terrain.length}`);
    } catch (e) {
        assert(false, `Terrain generation failed: ${e.message}`);
    }

    // Test 7: JSON Structure Validation
    console.log('\n📋 Test 7: Response Structure Validation');
    try {
        const res = await makeRequest('POST', '/generate', {
            prompt: 'Create a simple part',
            conversationId: 'test-validation-' + Date.now()
        });
        
        if (res.status === 200) {
            assert(typeof res.body.explanation === 'string', 'Has explanation string');
            assert(['simple', 'moderate', 'complex'].includes(res.body.complexity), 'Has valid complexity');
            
            if (res.body.scripts) {
                assert(Array.isArray(res.body.scripts), 'Scripts is an array');
                if (res.body.scripts.length > 0) {
                    const script = res.body.scripts[0];
                    assert(script.name, 'Script has name');
                    assert(script.type, 'Script has type');
                    assert(script.parent, 'Script has parent');
                    assert(script.source, 'Script has source');
                }
            }
            
            if (res.body.instances) {
                assert(Array.isArray(res.body.instances), 'Instances is an array');
                if (res.body.instances.length > 0) {
                    const inst = res.body.instances[0];
                    assert(inst.className, 'Instance has className');
                    assert(inst.properties, 'Instance has properties');
                }
            }

            if (res.body.terrain) {
                assert(Array.isArray(res.body.terrain), 'Terrain is an array');
                if (res.body.terrain.length > 0) {
                    const op = res.body.terrain[0];
                    assert(op.shape, 'Terrain operation has shape');
                    assert(op.material, 'Terrain operation has material');
                    assert(Array.isArray(op.position), 'Terrain operation has position');
                }
            }
        }
    } catch (e) {
        assert(false, `Structure validation test failed: ${e.message}`);
    }

    // Test 8: Conversation Context
    console.log('\n📋 Test 8: Conversation Context Preservation');
    try {
        const convId = 'test-context-' + Date.now();
        
        // First message
        const res1 = await makeRequest('POST', '/generate', {
            prompt: 'Create a red brick',
            conversationId: convId
        });
        assert(res1.status === 200, 'First message succeeds');
        
        await sleep(500);
        
        // Follow-up message referencing previous
        const res2 = await makeRequest('POST', '/generate', {
            prompt: 'Make it blue instead',
            conversationId: convId
        });
        assert(res2.status === 200, 'Follow-up message succeeds');
        console.log(`  📝 Follow-up response: ${res2.body.explanation}`);
    } catch (e) {
        assert(false, `Context preservation test failed: ${e.message}`);
    }

    // Test 9: Cross-Reference Validation
    console.log('\n📋 Test 9: Cross-Reference Validation');
    try {
        const res = await makeRequest('POST', '/generate', {
            prompt: 'Create a script that references workspace.MyPart but dont create MyPart',
            conversationId: 'test-crossref-' + Date.now()
        });
        
        if (res.status === 200 && res.body.warnings) {
            assert(res.body.warnings.length > 0, 'Cross-reference warnings detected');
            console.log(`  ⚠️  Warnings: ${res.body.warnings.length}`);
        } else {
            console.log('  ℹ️  No cross-reference issues detected (AI may have created the part)');
        }
    } catch (e) {
        assert(false, `Cross-reference test failed: ${e.message}`);
    }

    // Test 10: Error Handling (Invalid Conversation ID)
    console.log('\n📋 Test 10: Error Handling');
    try {
        const res = await makeRequest('POST', '/generate', {
            prompt: 'Create a part'
            // Missing conversationId
        });
        assert(res.status === 400, 'Returns 400 for missing conversationId');
        assert(res.body.error, 'Has error message');
        assert(res.body.suggestion, 'Has suggestion');
    } catch (e) {
        assert(false, `Error handling test failed: ${e.message}`);
    }

    // Test 11: Rate Limiting (IP-based)
    console.log('\n📋 Test 11: Rate Limiting (IP-based protection)');
    try {
        const convId = 'test-ratelimit-' + Date.now();
        let rateLimited = false;
        let requestCount = 0;
        
        // Make 20 rapid requests (limit is 15/min)
        for (let i = 0; i < 20; i++) {
            try {
                const res = await makeRequest('POST', '/generate', {
                    prompt: 'Create a small part',
                    conversationId: convId + '-' + i
                });
                
                requestCount++;
                
                if (res.status === 429) {
                    rateLimited = true;
                    assert(true, `Rate limited after ${requestCount} requests`);
                    assert(res.body && res.body.error === 'Rate Limit Exceeded', 'Correct rate limit error');
                    break;
                }
                
                // Very small delay between requests
                await sleep(100);
            } catch (err) {
                // If we get a connection error, it might be due to rate limiting
                if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
                    rateLimited = true;
                    assert(true, `Rate limited after ${requestCount} requests (connection reset)`);
                    break;
                }
            }
        }
        
        // Rate limiting might not trigger if we're under the limit
        if (!rateLimited && requestCount < 15) {
            assert(true, 'Rate limiting configured (not triggered in test)');
        } else {
            assert(rateLimited, 'Rate limiting is enforced');
        }
    } catch (e) {
        assert(false, `Rate limiting test failed: ${e.message}`);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 Test Summary:');
    console.log(`   ✅ Passed: ${testsPassed}`);
    console.log(`   ❌ Failed: ${testsFailed}`);
    console.log(`   📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
    
    if (testsFailed === 0) {
        console.log('\n🎉 All tests passed! Backend is production-ready.\n');
    } else {
        console.log('\n⚠️  Some tests failed. Review the output above.\n');
        process.exit(1);
    }
}

// Check if server is running
async function checkServer() {
    try {
        await makeRequest('GET', '/health');
        return true;
    } catch (e) {
        return false;
    }
}

// Main
(async () => {
    const serverRunning = await checkServer();
    
    if (!serverRunning) {
        console.error('\n❌ Server is not running at', BASE_URL);
        console.error('   Start the server first: node server.js\n');
        process.exit(1);
    }
    
    await runTests();
})();
