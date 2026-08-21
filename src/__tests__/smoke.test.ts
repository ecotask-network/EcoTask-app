describe('test infrastructure', () => {
  it('jest is functional', () => {
    expect(true).toBe(true);
  });

  it('can import from the project', () => {
    const validation = require('../utils/validation');
    expect(validation).toBeDefined();
  });
});
