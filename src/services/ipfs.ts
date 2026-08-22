import Config from 'react-native-config';

const IPFS_API_URL = Config.IPFS_API_URL || 'https://api.pinata.cloud';
const IPFS_GATEWAY = Config.IPFS_GATEWAY || 'https://ipfs.io/ipfs/';
const IPFS_API_KEY = Config.IPFS_API_KEY || '';
const IPFS_SECRET = Config.IPFS_SECRET || '';

interface PinataResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

interface IPFSUploadResult {
  cid: string;
  url: string;
  size: number;
}

function getAuthHeaders(): Record<string, string> {
  if (IPFS_API_KEY && IPFS_SECRET) {
    return {
      pinata_api_key: IPFS_API_KEY,
      pinata_secret_api_key: IPFS_SECRET,
    };
  }
  if (IPFS_API_KEY) {
    return { Authorization: `Bearer ${IPFS_API_KEY}` };
  }
  return {};
}

export async function pinFile(
  filePath: string,
  fileName: string,
): Promise<IPFSUploadResult> {
  if (!IPFS_API_KEY) {
    throw new Error('IPFS API key not configured. Set IPFS_API_KEY in .env');
  }

  interface ReactNativeFilePart {
    uri: string;
    type: string;
    name: string;
  }

  const formData = new FormData();
  formData.append('file', {
    uri: filePath.startsWith('file://') ? filePath : `file://${filePath}`,
    type: 'image/jpeg',
    name: fileName,
  } as ReactNativeFilePart as unknown as Blob);

  formData.append(
    'pinataMetadata',
    JSON.stringify({
      name: fileName,
    }),
  );

  const response = await fetch(`${IPFS_API_URL}/pinning/pinFileToIPFS`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`IPFS pin failed: ${error}`);
  }

  const data: PinataResponse = await response.json();

  return {
    cid: data.IpfsHash,
    url: `${IPFS_GATEWAY}${data.IpfsHash}`,
    size: data.PinSize,
  };
}

export async function pinJSON(
  content: Record<string, unknown>,
  name: string,
): Promise<IPFSUploadResult> {
  if (!IPFS_API_KEY) {
    throw new Error('IPFS API key not configured. Set IPFS_API_KEY in .env');
  }

  const response = await fetch(`${IPFS_API_URL}/pinning/pinJSONToIPFS`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      pinataContent: content,
      pinataMetadata: { name },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`IPFS pin failed: ${error}`);
  }

  const data: PinataResponse = await response.json();

  return {
    cid: data.IpfsHash,
    url: `${IPFS_GATEWAY}${data.IpfsHash}`,
    size: data.PinSize,
  };
}

export function getIPFSUrl(cid: string): string {
  return `${IPFS_GATEWAY}${cid}`;
}
