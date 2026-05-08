import { FormEvent, useState } from "react";

import { ForgetPassRequest } from "../dto/forget-pass.dto";

const defaultValues: ForgetPassRequest = {
  email: "",
};

export function useForgetPassForm(onSubmit: (payload: ForgetPassRequest) => Promise<void>) {
  const [values, setValues] = useState<ForgetPassRequest>(defaultValues);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit(values);
  };

  return {
    values,
    setField: (name: keyof ForgetPassRequest, value: string) => {
      setValues((prev) => ({ ...prev, [name]: value }));
    },
    handleSubmit,
  };
}