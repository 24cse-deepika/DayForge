const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveDependencies } = require('../scheduler/dependencyResolver');

// ── resolveDependencies ───────────────────────────────────────────────────────

test('resolveDependencies: linear chain A→B→C, only A in readyQueue', () => {
    const tasks = [
        { id: 'A', dependencies: [] },
        { id: 'B', dependencies: ['A'] },
        { id: 'C', dependencies: ['B'] }
    ];
    const result = resolveDependencies(tasks);
    assert.equal(result.success, true);
    assert.equal(result.readyQueue.length, 1);
    assert.equal(result.readyQueue[0].id, 'A');
});

test('resolveDependencies: multiple root tasks both in readyQueue', () => {
    const tasks = [
        { id: 'A', dependencies: [] },
        { id: 'B', dependencies: [] },
        { id: 'C', dependencies: ['A'] }
    ];
    const result = resolveDependencies(tasks);
    assert.equal(result.success, true);
    assert.equal(result.readyQueue.length, 2);
    const ids = result.readyQueue.map(t => t.id);
    assert.ok(ids.includes('A'));
    assert.ok(ids.includes('B'));
});

test('resolveDependencies: all tasks independent — all in readyQueue', () => {
    const tasks = [
        { id: 'A', dependencies: [] },
        { id: 'B', dependencies: [] },
        { id: 'C', dependencies: [] }
    ];
    const result = resolveDependencies(tasks);
    assert.equal(result.success, true);
    assert.equal(result.readyQueue.length, 3);
});

test('resolveDependencies: simple cycle A→B→A fails', () => {
    const tasks = [
        { id: 'A', dependencies: ['B'] },
        { id: 'B', dependencies: ['A'] }
    ];
    const result = resolveDependencies(tasks);
    assert.equal(result.success, false);
});

test('resolveDependencies: 3-node cycle A→B→C→A fails', () => {
    const tasks = [
        { id: 'A', dependencies: ['C'] },
        { id: 'B', dependencies: ['A'] },
        { id: 'C', dependencies: ['B'] }
    ];
    const result = resolveDependencies(tasks);
    assert.equal(result.success, false);
});

test('resolveDependencies: missing dependency ID fails', () => {
    const tasks = [{ id: 'A', dependencies: ['DOES_NOT_EXIST'] }];
    const result = resolveDependencies(tasks);
    assert.equal(result.success, false);
});

test('resolveDependencies: adj map correctly maps parent to children', () => {
    const tasks = [
        { id: 'A', dependencies: [] },
        { id: 'B', dependencies: ['A'] },
        { id: 'C', dependencies: ['A'] }
    ];
    const result = resolveDependencies(tasks);
    assert.equal(result.success, true);
    assert.ok(result.adj['A'].includes('B'));
    assert.ok(result.adj['A'].includes('C'));
});

test('resolveDependencies: empty task list succeeds with empty queue', () => {
    const result = resolveDependencies([]);
    assert.equal(result.success, true);
    assert.equal(result.readyQueue.length, 0);
});