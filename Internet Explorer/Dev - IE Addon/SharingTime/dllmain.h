// dllmain.h : Declaration of module class.

class CSTModule : public CAtlDllModuleT< CSTModule >
{
public :
	DECLARE_LIBID(LIBID_STLib)
	DECLARE_REGISTRY_APPID_RESOURCEID(IDR_ST, "{8705C31F-EB94-4670-97C6-19CB290960B9}")
};

extern class CSTModule _AtlModule;
