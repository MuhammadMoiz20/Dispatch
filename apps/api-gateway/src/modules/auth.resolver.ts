import { Args, Field, InputType, Mutation, ObjectType, Resolver } from '@nestjs/graphql';
import axios from 'axios';

@ObjectType()
class AuthResult {
  @Field()
  token!: string;
  @Field()
  userId!: string;
  @Field()
  tenantId!: string;
}

@InputType()
class SignupInput {
  @Field()
  email!: string;
  @Field()
  password!: string;
  @Field()
  tenantName!: string;
}

@InputType()
class LoginInput {
  @Field()
  email!: string;
  @Field()
  password!: string;
}

@Resolver()
export class AuthResolver {
  private usersBase = process.env.USERS_URL || 'http://127.0.0.1:4001';

  @Mutation(() => AuthResult)
  async signup(@Args('input') input: SignupInput): Promise<AuthResult> {
    const res = await axios.post(`${this.usersBase}/v1/auth/signup`, input, { validateStatus: () => true });
    if (res.status >= 400) throw mapHttpToGqlError('SIGNUP_FAILED', res.status, res.data);
    return res.data;
  }

  @Mutation(() => AuthResult)
  async login(@Args('input') input: LoginInput): Promise<AuthResult> {
    const res = await axios.post(`${this.usersBase}/v1/auth/login`, input, { validateStatus: () => true });
    if (res.status >= 400) throw mapHttpToGqlError('LOGIN_FAILED', res.status, res.data);
    return res.data;
  }
}

function mapHttpToGqlError(code: string, status: number, data: any): Error {
  const message = data?.message || data?.error || 'Request failed';
  const err = new Error(message);
  (err as any).extensions = {
    code,
    httpStatus: status,
    details: data,
  };
  return err;
}
