# GetRpcProviders200ResponseData

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Active** | Pointer to [**GetRpcProviders200ResponseDataActive**](GetRpcProviders200ResponseDataActive.md) |  | [optional] 
**Supported** | Pointer to [**[]GetRpcProviders200ResponseDataSupportedInner**](GetRpcProviders200ResponseDataSupportedInner.md) |  | [optional] 

## Methods

### NewGetRpcProviders200ResponseData

`func NewGetRpcProviders200ResponseData() *GetRpcProviders200ResponseData`

NewGetRpcProviders200ResponseData instantiates a new GetRpcProviders200ResponseData object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewGetRpcProviders200ResponseDataWithDefaults

`func NewGetRpcProviders200ResponseDataWithDefaults() *GetRpcProviders200ResponseData`

NewGetRpcProviders200ResponseDataWithDefaults instantiates a new GetRpcProviders200ResponseData object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetActive

`func (o *GetRpcProviders200ResponseData) GetActive() GetRpcProviders200ResponseDataActive`

GetActive returns the Active field if non-nil, zero value otherwise.

### GetActiveOk

`func (o *GetRpcProviders200ResponseData) GetActiveOk() (*GetRpcProviders200ResponseDataActive, bool)`

GetActiveOk returns a tuple with the Active field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetActive

`func (o *GetRpcProviders200ResponseData) SetActive(v GetRpcProviders200ResponseDataActive)`

SetActive sets Active field to given value.

### HasActive

`func (o *GetRpcProviders200ResponseData) HasActive() bool`

HasActive returns a boolean if a field has been set.

### GetSupported

`func (o *GetRpcProviders200ResponseData) GetSupported() []GetRpcProviders200ResponseDataSupportedInner`

GetSupported returns the Supported field if non-nil, zero value otherwise.

### GetSupportedOk

`func (o *GetRpcProviders200ResponseData) GetSupportedOk() (*[]GetRpcProviders200ResponseDataSupportedInner, bool)`

GetSupportedOk returns a tuple with the Supported field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSupported

`func (o *GetRpcProviders200ResponseData) SetSupported(v []GetRpcProviders200ResponseDataSupportedInner)`

SetSupported sets Supported field to given value.

### HasSupported

`func (o *GetRpcProviders200ResponseData) HasSupported() bool`

HasSupported returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


