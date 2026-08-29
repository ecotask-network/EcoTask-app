import './__mocks__/setup';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text, TextInput, TouchableOpacity, Alert } from 'react-native';

jest.mock('../services/api', () => ({
  updateProfile: jest.fn(),
}));

jest.mock('../navigation/useAppNavigation', () => ({
  useRootNavigation: jest.fn(),
}));

import EditProfileScreen from '../screens/EditProfileScreen';
import { useUserStore } from '../store/userStore';
import { updateProfile } from '../services/api';
import { useRootNavigation } from '../navigation/useAppNavigation';

const mockUpdateProfile = updateProfile as jest.Mock;
const mockUseRootNavigation = useRootNavigation as jest.Mock;

function inputByPlaceholder(
  tree: renderer.ReactTestRenderer,
  placeholder: string,
): renderer.ReactTestInstance {
  const input = tree.root
    .findAllByType(TextInput)
    .find(i => i.props.placeholder === placeholder);
  if (!input) {
    throw new Error(
      `Could not find an input with placeholder "${placeholder}"`,
    );
  }
  return input;
}

function buttonWithText(
  tree: renderer.ReactTestRenderer,
  label: string,
): renderer.ReactTestInstance {
  const button = tree.root
    .findAllByType(TouchableOpacity)
    .find(node =>
      node.findAllByType(Text).some(text => text.props.children === label),
    );
  if (!button) {
    throw new Error(`Could not find a button labelled "${label}"`);
  }
  return button;
}

const INITIAL_PROFILE = {
  id: 'u1',
  wallet: 'GABC',
  name: 'Old Name',
  bio: 'Old bio',
  stats: {
    treesPlanted: 1,
    plasticCollected: 0,
    co2Reduced: 0,
  },
};

describe('EditProfileScreen', () => {
  let navigate: jest.Mock;
  let goBack: jest.Mock;
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    navigate = jest.fn();
    goBack = jest.fn();
    mockUseRootNavigation.mockReturnValue({ navigate, goBack });

    useUserStore.getState().setProfile({ ...INITIAL_PROFILE });

    mockUpdateProfile.mockResolvedValue({ name: 'New Name', bio: 'New bio' });

    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  function render() {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<EditProfileScreen />);
    });
    return tree;
  }

  it('initializes the inputs from the current profile', () => {
    const tree = render();
    expect(inputByPlaceholder(tree, 'Your name').props.value).toBe('Old Name');
    expect(
      inputByPlaceholder(tree, 'Tell others about yourself').props.value,
    ).toBe('Old bio');
  });

  it('updates local state when the name input changes', () => {
    const tree = render();
    act(() => {
      inputByPlaceholder(tree, 'Your name').props.onChangeText('New Name');
    });
    expect(inputByPlaceholder(tree, 'Your name').props.value).toBe('New Name');
  });

  it('updates local state when the bio input changes', () => {
    const tree = render();
    act(() => {
      inputByPlaceholder(tree, 'Tell others about yourself').props.onChangeText(
        'A fresh bio',
      );
    });
    expect(
      inputByPlaceholder(tree, 'Tell others about yourself').props.value,
    ).toBe('A fresh bio');
  });

  it('saves and calls api.updateProfile with the trimmed payload', async () => {
    const tree = render();
    act(() => {
      inputByPlaceholder(tree, 'Your name').props.onChangeText('  New Name  ');
    });
    act(() => {
      inputByPlaceholder(tree, 'Tell others about yourself').props.onChangeText(
        '  New bio  ',
      );
    });

    await act(async () => {
      await buttonWithText(tree, 'Save Changes').props.onPress();
    });

    expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
    expect(mockUpdateProfile).toHaveBeenCalledWith({
      name: 'New Name',
      bio: 'New bio',
    });
  });

  it('omits bio from the payload when it is empty', async () => {
    const tree = render();
    act(() => {
      inputByPlaceholder(tree, 'Your name').props.onChangeText('New Name');
    });
    act(() => {
      inputByPlaceholder(tree, 'Tell others about yourself').props.onChangeText(
        '   ',
      );
    });

    await act(async () => {
      await buttonWithText(tree, 'Save Changes').props.onPress();
    });

    expect(mockUpdateProfile).toHaveBeenCalledWith({
      name: 'New Name',
      bio: undefined,
    });
  });

  it('updates userStore.profile on success and navigates back', async () => {
    const tree = render();
    act(() => {
      inputByPlaceholder(tree, 'Your name').props.onChangeText('New Name');
    });
    act(() => {
      inputByPlaceholder(tree, 'Tell others about yourself').props.onChangeText(
        'New bio',
      );
    });

    await act(async () => {
      await buttonWithText(tree, 'Save Changes').props.onPress();
    });

    const profile = useUserStore.getState().profile;
    expect(profile?.name).toBe('New Name');
    expect(profile?.bio).toBe('New bio');
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('shows an error alert and keeps the profile on API failure', async () => {
    mockUpdateProfile.mockRejectedValue(new Error('Boom'));

    const tree = render();
    act(() => {
      inputByPlaceholder(tree, 'Your name').props.onChangeText('New Name');
    });

    await act(async () => {
      await buttonWithText(tree, 'Save Changes').props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith('Save Failed', 'Boom');
    expect(useUserStore.getState().profile?.name).toBe('Old Name');
    expect(goBack).not.toHaveBeenCalled();
  });

  it('blocks save and alerts when the name is empty', async () => {
    const tree = render();
    act(() => {
      inputByPlaceholder(tree, 'Your name').props.onChangeText('   ');
    });

    await act(async () => {
      await buttonWithText(tree, 'Save Changes').props.onPress();
    });

    expect(mockUpdateProfile).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Name cannot be empty');
  });

  it('navigates back when Cancel is pressed', () => {
    const tree = render();
    act(() => {
      buttonWithText(tree, 'Cancel').props.onPress();
    });
    expect(goBack).toHaveBeenCalledTimes(1);
  });
});
