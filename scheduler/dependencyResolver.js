const {ERROR_CODES} = require('../utils/constants');

function resolveDependencies(tasks) {
    const adj = {};
    let ready_queue = []; // tasks with no dependencies, ready to be scheduled
    
    // Build adjacency list
    tasks.forEach(task => {
        for(let dep of (task.dependencies || [])) {
            if(!adj[dep]) {
                adj[dep] = [];
            }
            adj[dep].push(task.id);
        };

        if((task.dependencies || []).length === 0) {
            ready_queue.push(task.id);
        }
    });

    let indegree = {};
    tasks.forEach(task => {
        indegree[task.id] = 0; // initialize indegree
    });

    let queue = [];
    let res = [];

    // Calculate indegree    
    for (let taskId in adj) {
        adj[taskId].forEach(dep => {
            indegree[dep]++;
        });
    }

    // Find all nodes with zero indegree
    for (let taskId in indegree) {
        if (indegree[taskId] === 0) {
            queue.push(taskId);
        }
    }

    // Process nodes in topological order
    while (queue.length > 0) {
        let current = queue.shift();
        res.push(current);

        (adj[current] || []).forEach(dep => {
            indegree[dep]--;
            if (indegree[dep] === 0) {
                queue.push(dep);
            }
        });
    }

    if(res.length !== tasks.length) {
        return { success: false, error: { code: ERROR_CODES.CYCLIC_DEPENDENCY, message: "Cyclic dependency detected among tasks." } };
    }

    return { success: true, readyQueue: ready_queue, adj};
}

module.exports = {
    resolveDependencies
};