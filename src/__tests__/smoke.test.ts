import * as validation from '../utils/validation';

describe('test infrastructure', () => {
  it('jest is functional', () => {
    expect(true).toBe(true);
  });

  it('can import from the project', () => {
    expect(validation).toBeDefined();
  });
});
