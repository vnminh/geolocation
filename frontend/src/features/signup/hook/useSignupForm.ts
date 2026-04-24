import { FormEvent, useState } from "react";

import { SignupRequest } from "../dto/signup.dto";

const defaultValues: SignupRequest = {
  email: "",
  name: "",
  password: "",
  role: "user",
};

export function useSignupForm(onSubmit: (payload: SignupRequest) => Promise<void>) {
  const [values, setValues] = useState<SignupRequest>(defaultValues);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit(values);
  };

  return {
    values,
    setField: (name: keyof SignupRequest, value: string) => {
      setValues((prev) => ({ ...prev, [name]: value }));
    },
    handleSubmit,
  };
}