import { describe, expect, it } from 'vitest';
import { pickAudioSource } from './mediaManager';
import { initialState } from '../state/store';

describe('pickAudioSource', () => {
  it('uses front > right > floor > left > ceiling', () => {
    const sources = Object.fromEntries(['f','r','d','l','c'].map(id => [id, { id, kind: 'url' as const, url: id, name: id }]));
    const state = { ...initialState, sources, assignments: { front:'f', right:'r', floor:'d', left:'l', ceiling:'c' }, params: { ...initialState.params, faces: { front:true, right:true, floor:true, left:true, ceiling:true } } };
    expect(pickAudioSource(state)).toBe('f');
    expect(pickAudioSource({ ...state, assignments: { right:'r', floor:'d', left:'l', ceiling:'c' } })).toBe('r');
  });
  it('uses the one span source for an active wall', () => expect(pickAudioSource({ ...initialState, mode:'span', spanSourceId:'s', sources:{ s:{id:'s',kind:'url',url:'s',name:'s'} } })).toBe('s'));
});
