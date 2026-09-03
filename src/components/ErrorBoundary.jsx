import React from 'react';
export default class ErrorBoundary extends React.Component{
  constructor(props){super(props);this.state={failed:false};}
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(error,info){if(typeof console!=='undefined')console.error('Storefront render error',{message:error?.message,componentStack:info?.componentStack});}
  render(){if(this.state.failed)return <main className="error-recovery" role="alert"><div><p className="eyebrow">Something went wrong</p><h1>We couldn’t display this page.</h1><p>Your bag has not been intentionally cleared. Refresh the page to try again, or return to the storefront.</p><div className="error-recovery__actions"><button className="btn btn--dark" type="button" onClick={()=>location.reload()}>Refresh page</button><a className="btn" href="/">Return home</a></div></div></main>;return this.props.children;}
}
