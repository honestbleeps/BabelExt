#include "stdafx.h"
#include "STI.h"
#include <ShlGuid.h>
#include <vector>

// CSTI

STDMETHODIMP CSTI::SetSite(IUnknown *pUnkSite)
{
	MyDebug(_T("SetSite %x"), pUnkSite);

	IObjectWithSiteImpl<CSTI>::SetSite(pUnkSite);

	if(pUnkSite)
	{
		CComQIPtr<IServiceProvider> pServiceProvider = pUnkSite;
		if (FAILED(pServiceProvider->QueryService(SID_SWebBrowserApp, IID_IWebBrowser2, (void**)&pWebBrowser)))
			return E_FAIL;
		EventsImpl::DispEventAdvise(pWebBrowser);
		
	}
	else
	{
		EventsImpl::DispEventUnadvise(pWebBrowser);
	}

	return S_OK;
}

//////////////////////////////////////////////////////////////////////////
// web browser events
//////////////////////////////////////////////////////////////////////////

STDMETHODIMP CSTI::OnBeforeNavigate(IDispatch* pDisp , VARIANT* URL,
							 VARIANT* Flags, VARIANT* TarGetFrameName,
							 VARIANT* PostData, VARIANT* Headers, BOOL* Cancel)
{
	return S_OK;
}

STDMETHODIMP CSTI::OnDownloadBegin()
{
	BrowserRefreshDetector::ProcessDownloadBegin(false);
	return S_OK;
}

STDMETHODIMP CSTI::OnDownloadComplete()
{
	BrowserRefreshDetector::ProcessDownloadEnd(false);
	return S_OK;
}

STDMETHODIMP CSTI::OnDocumentComplete(IDispatch *pDisp, VARIANT *_url)
{
	if(pWebBrowser.IsEqualObject(pDisp))
		BrowserRefreshDetector::SignDocument();

	return this->OnDocumentComplete_doIt(pDisp, _url, true);
}

STDMETHODIMP CSTI::OnNavigateComplete2(IDispatch *pDisp, VARIANT *_url)
{
	return S_OK;
}

HRESULT CSTI::OnDocumentComplete_doIt( IDispatch *pDisp, VARIANT *URL, bool realOne )
{
	if(!pWebBrowser.IsEqualObject(pDisp))
		return S_OK;

	CString sURL = (TCHAR*)_bstr_t(*URL);

	MyDebug(_T("RealDocumentComplete %s"), sURL);

	if(sURL.Find(_T("https://")) != 0)
		return S_OK;

	// Fix a crash on this URL (displaying pdf from ordinance reservation)
	// https://new.familysearch.org/reservation/v1/trip/400445770014257040/pdf?&disableNoCache&disableNoStore&locale=en&depth=1
	if(sURL.Find(_T("/pdf?")) > 0)
		return S_OK;

	// Fix a crash on this URL (displaying other pdf files)
	// https://new.familysearch.org/reservation/v1/trip/400445770014257040/pdf?&disableNoCache&disableNoStore&locale=en&depth=1
	if(sURL.Find(_T(".pdf")) > 0)
		return S_OK;

	TCHAR   strTempBuffer[ MAX_PATH ];
	::GetModuleFileName( NULL, strTempBuffer, MAX_PATH );


	DWORD   dwHandle;
	DWORD   dwFileVersionInfoSize = GetFileVersionInfoSize( strTempBuffer, &dwHandle );

	std::vector<BYTE> pData( dwFileVersionInfoSize );
	GetFileVersionInfo( strTempBuffer, dwHandle, dwFileVersionInfoSize, static_cast<LPVOID>( &pData[0] ) );

	VS_FIXEDFILEINFO *ptFileInfo;
	UINT    uintSize;

	VerQueryValue( static_cast<LPVOID>( &pData[0] ), _T("\\"), reinterpret_cast<LPVOID*> ( &ptFileInfo ), &uintSize );
	unsigned short usMajorVersion = static_cast<unsigned short>( ( ptFileInfo->dwFileVersionMS >> 16 ) &0xffff );
	unsigned short usMinorVersion = static_cast<unsigned short>( ptFileInfo->dwFileVersionMS &0xffff );
	unsigned short usReleaseNumber = static_cast<unsigned short>( ( ptFileInfo->dwFileVersionLS >> 16 ) &0xffff);

	TCHAR url[1000];
	_stprintf( url, SCRIPT_INJECTION_URL, usMajorVersion, usMinorVersion, usReleaseNumber );
	ScriptInjector::InjectScript(pWebBrowser, url);
	//CString s;
	//s.Format(_T("URL: %s FLAG: %d"), (TCHAR*)_bstr_t(*URL), realOne);
	//::MessageBox(NULL, s, _T("Debug"), MB_OK);
	return S_OK;
}

IWebBrowser2* CSTI::GetBrowser()
{
	return pWebBrowser;
}