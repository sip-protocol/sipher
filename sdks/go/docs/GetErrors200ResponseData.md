# GetErrors200ResponseData

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**TotalCodes** | Pointer to **int32** |  | [optional] 
**Errors** | Pointer to [**[]GetErrors200ResponseDataErrorsInner**](GetErrors200ResponseDataErrorsInner.md) |  | [optional] 

## Methods

### NewGetErrors200ResponseData

`func NewGetErrors200ResponseData() *GetErrors200ResponseData`

NewGetErrors200ResponseData instantiates a new GetErrors200ResponseData object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewGetErrors200ResponseDataWithDefaults

`func NewGetErrors200ResponseDataWithDefaults() *GetErrors200ResponseData`

NewGetErrors200ResponseDataWithDefaults instantiates a new GetErrors200ResponseData object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetTotalCodes

`func (o *GetErrors200ResponseData) GetTotalCodes() int32`

GetTotalCodes returns the TotalCodes field if non-nil, zero value otherwise.

### GetTotalCodesOk

`func (o *GetErrors200ResponseData) GetTotalCodesOk() (*int32, bool)`

GetTotalCodesOk returns a tuple with the TotalCodes field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTotalCodes

`func (o *GetErrors200ResponseData) SetTotalCodes(v int32)`

SetTotalCodes sets TotalCodes field to given value.

### HasTotalCodes

`func (o *GetErrors200ResponseData) HasTotalCodes() bool`

HasTotalCodes returns a boolean if a field has been set.

### GetErrors

`func (o *GetErrors200ResponseData) GetErrors() []GetErrors200ResponseDataErrorsInner`

GetErrors returns the Errors field if non-nil, zero value otherwise.

### GetErrorsOk

`func (o *GetErrors200ResponseData) GetErrorsOk() (*[]GetErrors200ResponseDataErrorsInner, bool)`

GetErrorsOk returns a tuple with the Errors field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetErrors

`func (o *GetErrors200ResponseData) SetErrors(v []GetErrors200ResponseDataErrorsInner)`

SetErrors sets Errors field to given value.

### HasErrors

`func (o *GetErrors200ResponseData) HasErrors() bool`

HasErrors returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


