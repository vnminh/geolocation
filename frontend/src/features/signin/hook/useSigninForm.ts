import { FormEvent, useState } from "react";

import { SigninRequest } from "../dto/signin.dto";

export function useSigninForm(onSubmit: (payload: SigninRequest) => Promise<void>) {
  const [values, setValues] = useState<SigninRequest>({ email: "", password: "" });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit(values);
  };

  return {
    values,
    setField: (name: keyof SigninRequest, value: string) => {
      setValues((prev) => ({ ...prev, [name]: value }));
    },
    handleSubmit,
  };
}