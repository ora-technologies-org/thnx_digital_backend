type ApiResponse<T = unknown> = {
  success: boolean;
  message: string;
  data?: T;
};

export const success = <T>(
  message: string,
  data?: T
): ApiResponse<T> => {
  return {
    success: true,
    message,
    data,
  };
};

export const error = (
  message: string,
): ApiResponse => {
  return {
    success: false,
    message,
  };
};
