export let MOCK_CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';

export const setRealUserId = (id: string) => {
  MOCK_CURRENT_USER_ID = id;
};