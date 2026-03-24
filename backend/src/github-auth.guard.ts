import { Injectable, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GithubAuthGuard extends AuthGuard('github') {
  canActivate(context: ExecutionContext) {
    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
      throw new HttpException(
        'GitHub OAuth is not configured on this server. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.',
        HttpStatus.NOT_IMPLEMENTED,
      );
    }
    return super.canActivate(context);
  }

  getAuthenticateOptions(_context: ExecutionContext) {
    // Setting allow_signup to false and omitting cached login forces GitHub
    // to show the authorization page instead of silently auto-signing in.
    return { allow_signup: false };
  }
}
