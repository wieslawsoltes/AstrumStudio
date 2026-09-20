import test from 'node:test';
import assert from 'node:assert/strict';
import { localOperation, LocalProjectClient } from '../public/studio/packages/collaboration/local.js';
import { demoScene, clone, diffScenes } from '../public/studio/packages/core/index.js';

const create = () => localOperation(null, '/projects', 'POST', { scene: demoScene() }).write;

test('local creation validates and takes a detached scene snapshot', () => {
    const scene = demoScene();
    const operation = localOperation(null, '/projects', 'POST', { scene });
    scene.name = 'Unacknowledged edit';
    assert.notEqual(operation.write.scene.name, scene.name);
    assert.equal(operation.value.revision, 1);
    assert.deepEqual(operation.write.comments, []);
    assert.throws(() => localOperation(null, '/projects', 'POST', { scene: {} }));
});
test('local reads return detached scenes and local owner role', () => {
    const record = create();
    const { value } = localOperation(record, '/project', 'GET');
    value.scene.name = 'Only the returned copy';
    assert.notEqual(value.scene.name, record.scene.name);
    assert.equal(value.role, 'owner');
});
test('local writes enforce revision compare-and-swap without mutating old data', () => {
    const record = create(), scene = clone(record.scene);
    scene.name = 'Saved locally';
    const body = { revision: 1, ops: diffScenes(record.scene, scene) };
    const { write, value } = localOperation(record, '/project', 'PATCH', body);
    assert.equal(value.revision, 2);
    assert.equal(write.scene.name, 'Saved locally');
    assert.equal(record.revision, 1);
    assert.notEqual(record.name, write.name);
    assert.throws(() => localOperation(write, '/project', 'PATCH', body), e => e.status === 409 && e.data.revision === 2);
});
test('local writes reject invalid batches and invalid transformed documents', () => {
    const record = create();
    assert.throws(() => localOperation(record, '/project', 'PATCH', { revision: 1, ops: null }));
    const next = clone(record.scene); next.objects[0].scale = [0, 1, 1];
    assert.throws(() => localOperation(record, '/project', 'PATCH', { revision: 1, ops: diffScenes(record.scene, next) }));
    assert.equal(record.revision, 1);
});
test('local review notes retain frames and objects without altering scene revision', () => {
    const record = create();
    const { write } = localOperation(record, '/comments', 'POST', { text: '  Review  ', objectId: record.scene.objects[0].id, frame: 30 });
    const { value } = localOperation(write, '/comments', 'GET');
    assert.equal(value[0].text, 'Review'); assert.equal(value[0].frame, 30);
    assert.equal(value[0].object_id, record.scene.objects[0].id);
    assert.equal(value[0].author, 'local@astrum.browser');
    assert.equal(write.revision, record.revision);
    assert.equal(record.comments.length, 0);
    value[0].text = 'Detached'; assert.equal(write.comments[0].text, 'Review');
    assert.throws(() => localOperation(record, '/comments', 'POST', { text: ' ' }));
    assert.throws(() => localOperation(record, '/comments', 'POST', { text: 'x'.repeat(4001) }));
});
test('deleting a local project removes its embedded review notes', () => {
    const record = create();
    assert.deepEqual(localOperation(record, '/project', 'DELETE'), { remove: record.id, value: { ok: true } });
    assert.throws(() => localOperation(null, '/project', 'GET'), e => e.status === 404);
});
test('local mode never pretends to provide online invitations or account access', async () => {
    const record = create();
    for (const method of ['GET', 'POST', 'DELETE'])
        assert.throws(() => localOperation(record, '/members', method), e => e.status === 501);
    const client = new LocalProjectClient('test', null);
    assert.equal((await client.session()).mode, 'local');
    await assert.rejects(client.list(), /storage is unavailable/);
    client.dispose();
    await assert.rejects(client.session(), /closed/);
});
