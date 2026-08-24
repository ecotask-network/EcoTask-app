const fs = require('fs');

function replaceFile(path, replacer) {
  const content = fs.readFileSync(path, 'utf8');
  const newContent = replacer(content);
  fs.writeFileSync(path, newContent);
  console.log('Fixed ' + path);
}

replaceFile('src/__tests__/useNetworkStatus.test.tsx', c => c.replace(/\(r: any\)/g, '(r)'));
replaceFile('src/__tests__/useProofSubmit.test.tsx', c => c.replace(/\(r: any\)/g, '(r)'));
replaceFile('src/components/AchievementGrid.tsx', c => c.replace(/\(a: any\)/g, '(a)'));
replaceFile('src/hooks/useTaskFeed.ts', c => c.replace(/as any\);/g, ');'));

replaceFile('src/screens/SendTokensScreen.tsx', c => {
  return c.replace(/assetParam as any,/g, '// eslint-disable-next-line @typescript-eslint/no-explicit-any\n          assetParam as any,');
});

replaceFile('src/store/prefsStore.ts', c => {
  return c.replace(/\(notifee as any\)/g, '// eslint-disable-next-line @typescript-eslint/no-explicit-any\n                    (notifee as any)');
});
