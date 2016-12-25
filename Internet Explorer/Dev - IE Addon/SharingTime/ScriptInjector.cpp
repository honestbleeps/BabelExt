#include "StdAfx.h"
#include "ScriptInjector.h"

ScriptInjector::ScriptInjector(void)
{
}

ScriptInjector::~ScriptInjector(void)
{
}

void ScriptInjector::InjectScript( IWebBrowser2 *pBrowser, CString url )
{
	MyDebug(_T("InjectScript %s"), url);

	CComPtr<IDispatch> pDispDoc;
	pBrowser->get_Document(&pDispDoc);
	CComQIPtr<IHTMLDocument2> pDoc2 = pDispDoc;
	CComPtr<IHTMLElement> element;
	HRESULT hr = pDoc2->createElement(_bstr_t(_T("script")),  &element);
	CComQIPtr<IHTMLDOMNode> domnode = element;
	CComQIPtr<IHTMLScriptElement> scriptElement = element;
	if(!url.IsEmpty())
		hr = scriptElement->put_src(_bstr_t((LPCTSTR)url));

	CComPtr<IHTMLElement> body;
	hr = pDoc2->get_body(&body);

	if(body)
	{
		CComQIPtr<IHTMLDOMNode> bodyNode = body;
		CComPtr<IHTMLDOMNode> tmp;
		hr = bodyNode->appendChild(domnode, &tmp);
		MyDebug(_T("InjectScript succeeded with %x"), hr);
	}
}